#!/usr/bin/env bash
# Reuse only the newest same-repository PUSH run of this workflow. PR merge
# refs and subset dispatches cannot establish landing evidence.
set -euo pipefail
wf="${WF_REF%@*}"; wf="${wf##*/}"
newest_push() {
  gh api "repos/$GITHUB_REPOSITORY/actions/workflows/$wf/runs?head_sha=$1&event=push&per_page=100" \
    --jq "[.workflow_runs[] | select(.head_repository.full_name == \"$GITHUB_REPOSITORY\" and .id != $GITHUB_RUN_ID)] | max_by(.id) | select(. != null) | \"\(.status) \(.conclusion)\"" || true
}
green() { [ "$(newest_push "$1")" = 'completed success' ]; }
skip=false
# C1: the exact main SHA was already verified on a branch push.
if [ "$EVENT" = push ] && [ "$REF" = refs/heads/main ] && green "$GITHUB_SHA"; then skip=true; fi
# C3 (exact): identical parent tree, with green push evidence for that parent.
if [ "$skip" = false ] && [ "$EVENT" = push ] && parent=$(git rev-parse -q --verify HEAD~1) \
   && [ "$(git rev-parse 'HEAD^{tree}')" = "$(git rev-parse 'HEAD~1^{tree}')" ] && green "$parent"; then skip=true; fi
# C2: a same-repository PR may skip only after its head's push is green.
# Missing, red, fork, API-error and dispatch-only evidence run in full.
if [ "$EVENT" = pull_request ] && [ "$SAME_REPO" = true ]; then
  for _ in $(seq 1 50); do
    state=$(newest_push "$PR_HEAD")
    case "$state" in
      'completed success') skip=true; break ;;
      ''|completed\ *) break ;;
      *) sleep 30 ;;
    esac
  done
fi
echo "skip=$skip" >> "$GITHUB_OUTPUT"
