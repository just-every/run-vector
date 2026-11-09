# GitHub observation budget

Conservatively reserve five calls for the initial environment execution's discovery and four per-job log commands. The interrupted initial sleeping watcher recorded zero API calls; its process was gone before the replacement watcher started. No watchers overlap.

The replacement watcher made three REST observations of exact-SHA Verify 42530676501 on e0acd71c5e7ce8ce10a6f57bf947b9d1ce20b326: discovery at 22:38:55 UTC, status at 22:53:56 and final status at 23:03:56 on 8 November 2026. The final response was completed/failure. Failed-job metadata was read at 23:08:58, then the portability job archive once at 23:14:05. Every observation was separated by at least 300 seconds. Actual commands, times, responses and exits are in ci-receipt.json and ci-jobs.json.

The fifth observed invocation was `gh run view 42530676501 --repo just-every/run-vector --job 128884258409 --log-failed`; it succeeded. Its downloaded run archive was reused locally for core-runtime and worker-2 assertion excerpts, making no additional GitHub call. No direct job-log blob redirect or blocked archive was retried, and no alternate credential was sought.

Five reserved startup calls plus five observed calls consume the conservative ten-call budget. No API/CLI workflow or PR observation was made for the subsequent checkpoint or terminal candidate. Git product/evidence transport is separate. The terminal normal-CI push requests Verify through the existing cloud-branch entry point, but its run ID/status is unobserved. Terminal custody is PUSHED, never READY or green from a different SHA.
