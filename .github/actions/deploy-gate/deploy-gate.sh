#!/usr/bin/env bash
# The deploy gate shared by every grupo-hyper repository that deploys on push.
# action.yml calls it; nothing else should.
#
#   deploy-gate.sh decide   writes code=true or code=false to $GITHUB_OUTPUT
#   deploy-gate.sh record   marks $AFTER as live in $DEPLOY_ENV
#
# Environment:
#   REPO        owner/name of the calling repository
#   AFTER       the commit being deployed
#   DEPLOY_ENV  the target environment. `record` sets the commit status
#               `deployed/$DEPLOY_ENV`; `decide` looks for it.
#   EVENT       github.event_name (decide, optional). A manual run always deploys.
#   RUN_URL     link for the status (record, optional)
#   GH_TOKEN    read by `gh`
#
# `decide` compares against the newest ancestor carrying the marker -- the last
# commit that actually reached the environment -- NOT the previous push.
# `concurrency` drops runs (it cancels one in progress, or replaces one still
# queued), so a code push can end with no deploy at all; judging the next push
# by its own range then skips a docs-only push and the code never ships. That
# is what happened in contratapj-backend on 2026-09-15.
#
# `decide` fails open to deploying: a manual run, no marker in the last 100
# commits, an API error, an unreadable, empty or possibly truncated file list
# all mean code=true.
#
# No value is piped into a reader that can stop early. `grep -q` exits at its
# first match, and with pipefail the writer still feeding it fails the whole
# pipeline (SIGPIPE, 141) -- which, in an `if`, read as "documentation only"
# and skipped a deploy that had code, once the file list outgrew the pipe
# buffer. Found by contratapj-bot on contratapj-payments-ms #13 with 299 long
# `.ts` paths. Every reader below takes a here-string instead.
set -uo pipefail

mode=${1:-}
case "$mode" in
  decide | record) ;;
  *)
    echo "::error::usage: deploy-gate.sh decide|record (got '$mode')"
    exit 2
    ;;
esac

decide() { echo "code=$1" >> "$GITHUB_OUTPUT"; }

# Without an environment the gate cannot tell which marker it means. Deploy
# (fail open) and fail the step, so the run shows why.
if [ -z "${DEPLOY_ENV:-}" ]; then
  echo "::error::deploy-env is empty: the gate cannot tell which environment it guards."
  [ "$mode" = decide ] && decide true
  exit 1
fi
context="deployed/$DEPLOY_ENV"

if [ "$mode" = record ]; then
  args=(-f state=success -f context="$context" -f description="Live in $DEPLOY_ENV")
  [ -n "${RUN_URL:-}" ] && args+=(-f target_url="$RUN_URL")
  gh api "repos/$REPO/statuses/$AFTER" "${args[@]}" > /dev/null
  exit $?
fi

if [ "${EVENT:-}" = "workflow_dispatch" ]; then
  echo "::notice::Manual run -- deploying."
  decide true
  exit 0
fi

# shellcheck disable=SC2016 # `$owner` etc. are GraphQL variables, not shell ones
query='query($owner: String!, $name: String!, $expr: String!, $ctx: String!) {
  repository(owner: $owner, name: $name) {
    object(expression: $expr) {
      ... on Commit {
        history(first: 100) { nodes { oid status { context(name: $ctx) { state } } } }
      }
    }
  }
}'
if ! history=$(gh api graphql -f query="$query" \
    -f owner="${REPO%%/*}" -f name="${REPO#*/}" -f expr="$AFTER" -f ctx="$context"); then
  echo "::warning::Could not read the deploy history. Treating as code."
  decide true
  exit 0
fi

# A status other than SUCCESS is not a deploy.
BASE=$(jq -r '[.data.repository.object.history.nodes[]? | select(.status.context.state == "SUCCESS") | .oid] | first // empty' <<< "$history" 2>/dev/null)
if [ -z "$BASE" ]; then
  echo "::warning::No commit in the last 100 carries $context. Treating as code."
  decide true
  exit 0
fi
echo "Last commit deployed to $DEPLOY_ENV: $BASE"

# Everything since that commit, not just this push. A re-run of the commit that
# is already live compares it with itself, finds no files and deploys -- which
# is what a re-run is for.
if ! payload=$(gh api "/repos/$REPO/compare/$BASE...$AFTER"); then
  echo "::warning::Could not compare $BASE..$AFTER. Treating as code."
  decide true
  exit 0
fi

count=$(jq '.files | length' <<< "$payload" 2>/dev/null)
case "$count" in
  '' | *[!0-9]*)
    echo "::warning::Could not read the compare response. Treating as code."
    decide true
    exit 0
    ;;
esac

# The compare endpoint caps `files` at 300. A truncated list cannot be judged --
# the code could be in the part that was cut.
if [ "$count" -ge 300 ]; then
  echo "::warning::Compare returned $count files and may be truncated. Treating as code."
  decide true
  exit 0
fi

# Renames report the new path in `filename` and the original in
# `previous_filename`; both are judged, so moving code onto a `.md` path does
# not read as documentation.
files=$(jq -r '.files[]? | .filename, (.previous_filename // empty)' <<< "$payload")

if [ -z "$files" ]; then
  echo "::warning::No files changed since $BASE. Treating as code."
  decide true
  exit 0
fi

echo "Changed files:"
while IFS= read -r changed; do echo "  $changed"; done <<< "$files"

if grep -qvE '\.md$' <<< "$files"; then
  decide true
  echo "::notice::Code changed -- deploying."
else
  decide false
  echo "::notice::Documentation only -- skipping the deploy."
fi
