#!/usr/bin/env bash
# Regression test for the deploy gate (deploy-gate.sh), and for how a
# repository's deploy workflow is wired to this action.
#
#   bash deploy-gate.test.sh <path to the calling repository's deploy workflow>
#
# The action runs it in `mode: test`, so every repository that uses the gate
# runs it in its own CI against its own workflow; this repository runs it on
# every change to the action, against test/fixture-deploy.yml.
#
# Part 1 runs deploy-gate.sh against a fake `gh` that serves canned API answers
# and records what was asked. Part 2 reads the deploy workflow and fails if the
# gate is no longer what decides the deploy -- a script can pass every scenario
# and still never run. Exits non-zero on any failure, including stopping early.

# SC2016: `${{ ... }}` below is literal workflow text, not shell.
# SC2329: the helpers are invoked through `expect "$@"`.
# shellcheck disable=SC2016,SC2329
set -u

here=$(cd "$(dirname "$0")" && pwd)
GATE="$here/deploy-gate.sh"
WORKFLOW=${1:-}

fails=0
pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; fails=$((fails + 1)); }

[ -f "$GATE" ] || { echo "FAIL  gate script not found at $GATE"; exit 1; }
[ -n "$WORKFLOW" ] && [ -f "$WORKFLOW" ] || { echo "FAIL  deploy workflow not found: '${WORKFLOW}' (pass its path as the first argument)"; exit 1; }

# A test that dies half-way must not report success. Without this, a crash
# under `set -u` exited 0 through the EXIT trap -- measured on an earlier
# version of this file -- so reaching the last line is the only way to pass.
finished=0
T=$(mktemp -d)
trap 'rm -rf "$T"; if [ "$finished" != 1 ]; then echo "FAIL  the test stopped before its last check"; exit 1; fi' EXIT

# ---- part 1: the gate -------------------------------------------------------

mkdir -p "$T/bin"
cat > "$T/bin/gh" <<'GH'
#!/usr/bin/env bash
# Fake gh: serves canned answers from $FAKE and records every call.
if [ "$1" = "api" ] && [ "$2" = "graphql" ]; then
  for a in "$@"; do case "$a" in ctx=*) echo "${a#ctx=}" >> "$FAKE/ctx.log" ;; esac; done
  [ -f "$FAKE/graphql.fail" ] && exit 1
  cat "$FAKE/graphql.json"
  exit 0
fi
if [ "$1" = "api" ] && [[ "$2" == */compare/* ]]; then
  range=${2##*/compare/}
  base=${range%%...*}
  echo "$range" >> "$FAKE/compare.log"
  [ -f "$FAKE/compare.fail" ] && exit 1
  if [ -f "$FAKE/compare-$base.json" ]; then cat "$FAKE/compare-$base.json"; else echo '{"files":[]}'; fi
  exit 0
fi
if [ "$1" = "api" ] && [[ "$2" == repos/*/statuses/* ]]; then
  shift
  printf '%s\n' "$@" > "$FAKE/status.log"
  [ -f "$FAKE/status.fail" ] && exit 1
  echo '{}'
  exit 0
fi
echo "fake gh: unexpected call: $*" >&2
exit 3
GH
chmod +x "$T/bin/gh"

A=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa # the commit being pushed
X=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb # the previous push: code whose deploy was cancelled
D=dddddddddddddddddddddddddddddddddddddddd # the last commit whose deploy succeeded

history_of() { # sha:STATE ... (STATE "none" = no marker) -> GraphQL history payload
  local out="" sep="" sha st item
  for item in "$@"; do
    sha=${item%%:*} st=${item#*:}
    if [ "$st" = none ]; then out="$out$sep{\"oid\":\"$sha\",\"status\":null}"
    else out="$out$sep{\"oid\":\"$sha\",\"status\":{\"context\":{\"state\":\"$st\"}}}"; fi
    sep=,
  done
  echo "{\"data\":{\"repository\":{\"object\":{\"history\":{\"nodes\":[$out]}}}}}"
}
files_of() { # path ... -> compare payload
  local out="" sep="" path
  for path in "$@"; do out="$out$sep{\"filename\":\"$path\"}"; sep=,; done
  echo "{\"files\":[$out]}"
}
scenarios_run=0
scenario() { scenarios_run=$((scenarios_run + 1)); export FAKE="$T/s$scenarios_run"; mkdir -p "$FAKE"; }

# gate <mode> [VAR=value ...] -- runs the gate in the current scenario; sets $rc
gate() {
  local mode=$1; shift
  : > "$T/out"
  ( export PATH="$T/bin:$PATH" GITHUB_OUTPUT="$T/out" GH_TOKEN=fake \
      REPO=grupo-hyper/example AFTER=$A DEPLOY_ENV=production EVENT=push
    for kv in "$@"; do export "${kv?}"; done
    bash "$GATE" "$mode" > "$FAKE/log" 2>&1 )
  rc=$?
}
decision() { grep -oE '^code=(true|false)$' "$T/out" | tail -1 | cut -d= -f2; }
first_base() { head -1 "$FAKE/compare.log" 2>/dev/null | sed 's/\.\.\..*//'; }

# check <name> <expected code> [expected compare base] [VAR=value ...]
check() {
  local name=$1 want=$2 want_base=${3:-}
  shift 3 2>/dev/null || shift $#
  gate decide "$@"
  local got base
  got=$(decision)
  base=$(first_base)
  if [ "$got" = "$want" ] && { [ -z "$want_base" ] || [ "$base" = "$want_base" ]; }; then
    pass "$name"
  else
    fail "$name -- want code=$want${want_base:+ from ${want_base:0:7}}, got code=${got:-<none>}${base:+ from ${base:0:7}}"
    sed 's/^/        | /' "$FAKE/log" | tail -5
  fi
}

scenario
history_of "$A:none" "$X:none" "$D:SUCCESS" > "$FAKE/graphql.json"
files_of docs/notes.md > "$FAKE/compare-$X.json"            # this push alone
files_of docs/notes.md src/app.ts > "$FAKE/compare-$D.json" # since the last real deploy
check "cancelled code deploy, then a docs-only push: deploys, comparing from the marked commit" true "$D"

scenario
history_of "$A:none" "$D:SUCCESS" > "$FAKE/graphql.json"
files_of README.md docs/a.md > "$FAKE/compare-$D.json"
check "markdown-only since the last deploy: skips" false "$D"

scenario
history_of "$A:none" "$X:none" "$D:SUCCESS" > "$FAKE/graphql.json"
files_of src/a.ts > "$FAKE/compare-$D.json"
check "stale marker, then a code change: deploys" true "$D"

scenario
history_of "$A:none" "$D:SUCCESS" > "$FAKE/graphql.json"
echo '{"files":[{"filename":"docs/x.md","previous_filename":"src/x.ts"}]}' > "$FAKE/compare-$D.json"
check "code renamed onto a .md path: deploys" true "$D"

scenario
history_of "$A:none" "$X:none" > "$FAKE/graphql.json"
check "no marker in the last 100 commits: deploys" true

scenario
history_of "$A:none" "$X:FAILURE" "$D:SUCCESS" > "$FAKE/graphql.json"
files_of docs/a.md > "$FAKE/compare-$X.json"
files_of docs/a.md src/b.ts > "$FAKE/compare-$D.json"
check "a marker that is not SUCCESS is not a deploy" true "$D"

scenario
touch "$FAKE/graphql.fail"
check "history API error: deploys" true

scenario
history_of "$A:SUCCESS" "$D:SUCCESS" > "$FAKE/graphql.json"
check "re-run of the commit already live (empty compare): deploys" true "$A"

scenario
history_of "$A:none" "$D:SUCCESS" > "$FAKE/graphql.json"
jq -n '{files: [range(300) | {filename: "docs/f\(.).md"}]}' > "$FAKE/compare-$D.json"
check "300-file compare, possibly truncated: deploys" true "$D"

scenario
history_of "$A:none" "$D:SUCCESS" > "$FAKE/graphql.json"
touch "$FAKE/compare.fail"
check "compare API error: deploys" true

scenario
history_of "$A:none" "$D:SUCCESS" > "$FAKE/graphql.json"
echo 'not json' > "$FAKE/compare-$D.json"
check "unreadable compare response: deploys" true

scenario
history_of "$A:none" "$D:SUCCESS" > "$FAKE/graphql.json"
long=$(printf '%0390d' 0)
jq -n --arg p "src/$long" '{files: ([{filename: ($p + "/first.ts")}] + [range(298) | {filename: ($p + "/f\(.).ts")}])}' > "$FAKE/compare-$D.json"
check "299 long code paths, larger than a pipe buffer: deploys" true "$D"

scenario
history_of "$A:none" "$D:SUCCESS" > "$FAKE/graphql.json"
files_of docs/a.md > "$FAKE/compare-$D.json"
check "manual run with only docs changed: deploys" true "" EVENT=workflow_dispatch

scenario
history_of "$A:none" "$D:SUCCESS" > "$FAKE/graphql.json"
files_of docs/a.md > "$FAKE/compare-$D.json"
gate decide
if [ "$(cat "$FAKE/ctx.log" 2>/dev/null)" = "deployed/production" ]; then
  pass "decide asks for its own environment's marker"
else
  fail "decide asks for its own environment's marker -- asked for '$(cat "$FAKE/ctx.log" 2>/dev/null)'"
fi

scenario
gate decide DEPLOY_ENV=
if [ "$(decision)" = true ] && [ "$rc" != 0 ]; then
  pass "decide with no deploy-env: deploys, and fails the step"
else
  fail "decide with no deploy-env: deploys, and fails the step -- got code=$(decision) exit=$rc"
fi

scenario
gate record RUN_URL=https://example.test/run/1
if [ "$rc" = 0 ] \
  && grep -qx "repos/grupo-hyper/example/statuses/$A" "$FAKE/status.log" \
  && grep -qx 'state=success' "$FAKE/status.log" \
  && grep -qx 'context=deployed/production' "$FAKE/status.log" \
  && grep -qx 'target_url=https://example.test/run/1' "$FAKE/status.log"; then
  pass "record marks the pushed commit as live in its environment"
else
  fail "record marks the pushed commit as live in its environment -- exit=$rc, call: $(tr '\n' ' ' < "$FAKE/status.log" 2>/dev/null)"
fi

scenario
touch "$FAKE/status.fail"
gate record
if [ "$rc" != 0 ]; then pass "record fails when the API refuses"; else fail "record fails when the API refuses -- exit 0"; fi

scenario
gate record DEPLOY_ENV=
if [ "$rc" != 0 ] && [ ! -f "$FAKE/status.log" ]; then
  pass "record with no deploy-env: refuses, without calling the API"
else
  fail "record with no deploy-env: refuses, without calling the API -- exit=$rc"
fi

scenario
gate bogus
if [ "$rc" = 2 ]; then pass "an unknown subcommand is refused"; else fail "an unknown subcommand is refused -- exit=$rc"; fi

# ---- part 2: the wiring of the calling repository's workflow ----------------
#
# Structural, not a grep over the whole file. Every property is checked inside
# the job it has to belong to -- and, for the gate and the marker, inside the
# step -- after comment lines and trailing comments are dropped, so a literal
# left in a comment or moved to another job fails here. The extraction follows
# indentation (two spaces per level, the form of every workflow that uses this
# action): a reformat breaks it and fails loudly, the safe direction for a
# guard. Lines are compared whole, with leading blanks and a list dash trimmed.

# The workflow minus comment lines and trailing ` # ...` comments.
code_only() { sed -E -e '/^[[:space:]]*#/d' -e "s/[[:space:]]+#[^\"']*\$//" "$WORKFLOW"; }
# Lines of top-level block <key>, up to the next top-level key.
top_block() { code_only | awk -v k="$1:" '$0 == k { on = 1; next } on && /^[^ ]/ { exit } on'; }
# Lines of job <name>, up to the next job.
job_block() { top_block jobs | awk -v k="  $1:" '$0 == k { on = 1; next } on && /^  [^ ]/ { exit } on'; }
# The step of job <job> that has the line <line>.
step_with() {
  job_block "$1" | WANT="$2" awk '
    /^    [^ ]/ { if (hit) exit; inside = 0; next }
    /^      - / { if (hit) exit; buf = ""; inside = 1 }
    inside      { buf = buf $0 "\n"; t = $0; sub(/^ +(- +)?/, "", t); if (t == ENVIRON["WANT"]) hit = 1 }
    END         { if (hit) printf "%s", buf }'
}
# Whether <text> has the line <line>.
has_line() { WANT="$2" awk '{ t = $0; sub(/^ +(- +)?/, "", t); if (t == ENVIRON["WANT"]) f = 1 } END { exit !f }' <<< "$1"; }
# The value of the `uses:` key in <text>.
uses_of() { awk '{ t = $0; sub(/^ +(- +)?/, "", t) } t ~ /^uses: / { sub(/^uses: /, "", t); print t; exit }' <<< "$1"; }
# This action, pinned to main (a per-repository pin is a copy that can drift),
# or referenced locally by the repository that hosts it.
is_this_action() { [[ "$1" =~ ^(grupo-hyper/[A-Za-z0-9_.-]+/([A-Za-z0-9_.-]+/)*deploy-gate@main|\./([A-Za-z0-9_.-]+/)*deploy-gate)$ ]]; }
expect() { # name, command...
  local name=$1; shift
  if "$@"; then pass "workflow: $name"; else fail "workflow: $name"; fi
}
nonempty() { [ -n "$1" ]; }
same() { [ -n "$1" ] && [ "$1" = "$2" ]; }
lacks_mode_or_decide() { ! grep -qE '^ +mode: ' <<< "$1" || has_line "$1" 'mode: decide'; }

changes=$(job_block changes)
deploy=$(job_block deploy)
gate_step=$(step_with changes 'id: filter')
record_step=$(step_with deploy 'mode: record')
gate_uses=$(uses_of "$gate_step")
record_uses=$(uses_of "$record_step")

expect "defines DEPLOY_ENV once, at workflow level" grep -qE '^  DEPLOY_ENV: .' <<< "$(top_block env)"
expect "has a changes job" nonempty "$changes"
expect "the changes job has the gate step (id: filter)" nonempty "$gate_step"
expect "the gate step uses this action at main (got '${gate_uses}')" is_this_action "$gate_uses"
expect "the gate step decides (no other mode)" lacks_mode_or_decide "$gate_step"
expect "the gate step passes DEPLOY_ENV" has_line "$gate_step" 'deploy-env: ${{ env.DEPLOY_ENV }}'
expect "the changes job exports the gate's decision" has_line "$changes" 'code: ${{ steps.filter.outputs.code }}'
expect "the changes job may read commit statuses" has_line "$changes" 'statuses: read'
expect "has a deploy job" nonempty "$deploy"
expect "the deploy job is skipped only on an explicit code=false" grep -qE "^    if: .*needs\.changes\.outputs\.code != 'false'" <<< "$deploy"
expect "the deploy job may write commit statuses" grep -qx '      statuses: write' <<< "$deploy"
expect "the deploy job has the step recording the marker (mode: record)" nonempty "$record_step"
expect "the record step uses the same action as the gate" same "$record_uses" "$gate_uses"
expect "the record step passes DEPLOY_ENV" has_line "$record_step" 'deploy-env: ${{ env.DEPLOY_ENV }}'
expect "recording the marker is best effort" has_line "$record_step" 'continue-on-error: true'
# A repository that cannot use the shared action (a public one: GitHub shares
# a private repository's actions only with private repositories) carries a copy
# under .github/actions and references it locally. A local action exists only
# after a checkout, so each job that uses it must check out first.
checkout_before() { # job text, the line that must come after a checkout
  WANT="$2" awk '/uses: actions\/checkout@/ && !c { c = NR } { t = $0; sub(/^ +(- +)?/, "", t) } t == ENVIRON["WANT"] && !f { f = NR } END { exit !(c && f && c < f) }' <<< "$1"
}
if [[ "$gate_uses" == ./* ]]; then
  expect "the changes job checks out before using the local copy" checkout_before "$changes" 'id: filter'
  expect "the deploy job checks out before using the local copy" checkout_before "$deploy" 'mode: record'
fi
if grep -qE 'github\.event\.before|deploy-gate\.sh' <<< "$(code_only)"; then
  fail "workflow: no copy of the old gate is left (github.event.before or a vendored deploy-gate.sh)"
else
  pass "workflow: no copy of the old gate is left"
fi

echo "---"
echo "$scenarios_run scenarios run"
finished=1
if [ "$fails" = 0 ]; then echo "ALL PASS"; else echo "$fails FAILED"; fi
exit "$fails"
