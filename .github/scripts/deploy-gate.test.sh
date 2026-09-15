#!/usr/bin/env bash
# Regression test for deploy-gate.sh, and for how THIS repository's deploy
# workflow is wired to it.
#
#   bash .github/scripts/deploy-gate.test.sh .github/workflows/<deploy workflow>
#
# Part 1 runs deploy-gate.sh against a fake `gh` that serves canned API answers
# and records what was asked. Part 2 reads the deploy workflow and fails if the
# gate is no longer what decides the deploy -- a script can pass every scenario
# and still never run.
#
# The SAME file is committed in every repository that has the gate, and
# deploy-gate-test.yml runs it in that repository's own CI, so each copy fails
# where it lives instead of drifting unnoticed. Exits non-zero on any failure.
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
# under `set -u` exited 0 through the EXIT trap -- measured on the first
# version of this file -- so reaching the last line is the only way to pass.
finished=0
T=$(mktemp -d)
trap 'rm -rf "$T"; if [ "$finished" != 1 ]; then echo "FAIL  the test stopped before its last check"; exit 1; fi' EXIT

# ---- part 1: the decision ---------------------------------------------------

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
scenario() { scenarios_run=$((scenarios_run + 1)); FAKE="$T/s$scenarios_run"; mkdir -p "$FAKE"; }

# check <name> <expected code> [expected compare base] [event]
check() {
  local name=$1 want=$2 want_base=${3:-} event=${4:-push} out="$T/out" got base
  : > "$out"
  ( PATH="$T/bin:$PATH" FAKE="$FAKE" GITHUB_OUTPUT="$out" GH_TOKEN=fake \
      REPO=grupo-hyper/example AFTER=$A DEPLOY_ENV=production EVENT="$event" \
      bash "$GATE" > "$FAKE/log" 2>&1 )
  got=$(grep -oE '^code=(true|false)$' "$out" | tail -1 | cut -d= -f2)
  base=$(head -1 "$FAKE/compare.log" 2>/dev/null | sed 's/\.\.\..*//')
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
files_of docs/a.md > "$FAKE/compare-$D.json"
check "manual run with only docs changed: deploys" true "" workflow_dispatch

scenario
history_of "$A:none" "$D:SUCCESS" > "$FAKE/graphql.json"
files_of docs/a.md > "$FAKE/compare-$D.json"
check "asks for its own environment's marker (setup)" false "$D"
if [ "$(cat "$FAKE/ctx.log" 2>/dev/null)" = "deployed/production" ]; then
  pass "asks for its own environment's marker"
else
  fail "asks for its own environment's marker -- asked for '$(cat "$FAKE/ctx.log" 2>/dev/null)'"
fi

# ---- part 2: the wiring of this repository's workflow -----------------------
#
# Literal checks, deliberately: a reformat that breaks one fails here, loudly,
# which is the safe direction for a guard.

wired() { # name, grep -E pattern that must match
  if grep -qE -- "$2" "$WORKFLOW"; then pass "workflow: $1"; else fail "workflow: $1 -- no line matches /$2/ in $WORKFLOW"; fi
}
wired "defines DEPLOY_ENV once, at workflow level" '^  DEPLOY_ENV: '
wired "the changes job runs this gate script" '^ +run: bash \.github/scripts/deploy-gate\.sh$'
wired "the gate step has id filter" '^ +id: filter$'
wired "the changes job exports the gate's decision" 'code: \$\{\{ steps\.filter\.outputs\.code \}\}'
wired "the deploy is skipped only on an explicit code=false" "needs\.changes\.outputs\.code != 'false'"
# shellcheck disable=SC2016 # `$DEPLOY_ENV` is literal text the workflow must contain
wired "the deploy job records the deployed/<env> marker" 'context="deployed/\$DEPLOY_ENV"'
wired "the deploy job may write commit statuses" '^ +statuses: write'
if grep -qE 'github\.event\.before' "$WORKFLOW"; then
  fail "workflow: never judges by the previous push -- github.event.before is back in $WORKFLOW"
else
  pass "workflow: never judges by the previous push (no github.event.before)"
fi

echo "---"
echo "$scenarios_run scenarios run"
finished=1
if [ "$fails" = 0 ]; then echo "ALL PASS"; else echo "$fails FAILED"; fi
exit "$fails"
