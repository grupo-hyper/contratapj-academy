#!/usr/bin/env bash
# Decides whether a push must be deployed, for the `changes` job of the deploy
# workflow. Writes `code=true` or `code=false` to $GITHUB_OUTPUT.
#
# Environment:
#   REPO        owner/name
#   AFTER       the commit this run would deploy
#   DEPLOY_ENV  the target environment. The deploy job marks every commit it
#               ships with the `deployed/$DEPLOY_ENV` commit status.
#   EVENT       github.event_name (optional). A manual run always deploys.
#   GH_TOKEN    read by `gh`
#
# The base of the comparison is the newest ancestor carrying that marker -- the
# last commit that actually reached the environment -- NOT the previous push.
# `concurrency` drops runs (it cancels one in progress, or replaces one still
# queued), so a code push can end with no deploy at all; judging the next push
# by its own range then skips a docs-only push and the code never ships. That
# is what happened in contratapj-backend on 2026-09-15.
#
# Fails open to deploying: a manual run, no marker in the last 100 commits, an
# API error, an unreadable, empty or possibly truncated file list all mean
# code=true.
#
# The SAME file is committed in every repository that has this gate, next to
# deploy-gate.test.sh, and each repository's CI runs that test against its own
# copy and its own workflow (deploy-gate-test.yml). A change here belongs in
# all of them.
set -uo pipefail

decide() { echo "code=$1" >> "$GITHUB_OUTPUT"; }

if [ "${EVENT:-}" = "workflow_dispatch" ]; then
  echo "::notice::Manual run -- deploying."
  decide true
  exit 0
fi

context="deployed/$DEPLOY_ENV"
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
BASE=$(printf '%s' "$history" | jq -r '[.data.repository.object.history.nodes[]? | select(.status.context.state == "SUCCESS") | .oid] | first // empty' 2>/dev/null)
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

count=$(printf '%s' "$payload" | jq '.files | length' 2>/dev/null)
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
files=$(printf '%s' "$payload" | jq -r '.files[]? | .filename, (.previous_filename // empty)')

if [ -z "$files" ]; then
  echo "::warning::No files changed since $BASE. Treating as code."
  decide true
  exit 0
fi

echo "Changed files:"
printf '%s\n' "$files" | sed 's/^/  /'

if printf '%s\n' "$files" | grep -qvE '\.md$'; then
  decide true
  echo "::notice::Code changed -- deploying."
else
  decide false
  echo "::notice::Documentation only -- skipping the deploy."
fi
