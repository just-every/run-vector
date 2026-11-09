# CI access receipt

GitHub budget used before candidate publication: 7 CLI invocations.

1. `gh api repos/just-every/run-vector/actions/runs/42520865907/attempts/2/jobs --jq '.jobs[] | {id,name,conclusion}'`: exit 0. Core-runtime job 128862510572 and aggregate verify job 128866536098 failed; other jobs succeeded.
2. `gh run view 42520865907 --repo just-every/run-vector --job 128862510572 --log-failed`: exit 0; stdout empty.
3. `gh run view 42520865907 --repo just-every/run-vector --attempt 2 --job 128866536098 --log-failed`: exit 0; stdout empty.
4. `gh api repos/just-every/run-vector/actions/runs/42520865907/attempts/2 --jq '{status,conclusion,head_sha,html_url}'`: completed/failure at 3503a75381109b411d3cac78293b1bbd28d3c82a.
5. `gh run view 42520865907 --repo just-every/run-vector --attempt 2 --job 128862510572 --log`: exit 0; stdout empty. No assertion text was available from the archive CLI.
6. `gh api repos/just-every/run-vector/actions/jobs/128862510572 --jq '{id,name,conclusion,steps,started_at,completed_at}'`: exit 0. Independent-shard verification step failed; infrastructure/install/artifact restore steps succeeded.
7. `gh run download 42520865907 --repo just-every/run-vector --name vector-verification-core-runtime --dir /tmp/vector-start-artifact`: exit 1, HTTP 403 Forbidden at the redirected artifact blob. Signed query omitted. This download was not retried.

No assertion from this old run is claimed to have been read. Local reproduction and the new exact-SHA run determine current behavior. Credentials were loaded privately from the fleet bundle for each CLI call.

8. `gh api 'repos/just-every/run-vector/actions/runs?head_sha=46a15bf8c93017a98d65e8612587e05d8acc2609&per_page=100' --jq '.workflow_runs[] | {id,name,status,conclusion,head_sha,html_url,created_at}'`: exit 0. Exact-SHA Verify 42538592587 was in_progress, observed at 00:09 UTC on 9 November 2026. Two CLI calls remain; no more discovery or status calls until the run has had its full build and shard window.

9. `gh api 'repos/just-every/run-vector/actions/runs?head_sha=60b465d927881a05b01253df7743e3ac8c0456e9&per_page=100' --jq '.workflow_runs[] | {id,name,status,conclusion,head_sha,html_url,created_at}'`: exit 0. Final exact-SHA Verify 42539853736 was pending, observed at 00:22 UTC on 9 November 2026. One CLI call remains. The earlier run was superseded by restoring main's original historical project test checkpoint; no published history was rewritten.
