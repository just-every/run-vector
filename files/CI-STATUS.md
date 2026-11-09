# Exact-SHA CI custody

Repository: just-every/run-vector
Branch: cloud/sd-vector-c-f205-fix4
Head: 845d247813161432dec41959a2faa72090397bb1
Verify run: 42562058136
URL: https://github.com/just-every/run-vector/actions/runs/42562058136
Final observed status: in_progress
Final observed conclusion: null
Disposition: PUSHED; READY is not claimed.

One watcher discovered the exact head using the actions/runs head_sha REST query and polled the exact run twice, each at least 300 seconds after its preceding call. All returned the same full candidate SHA. The final observation remained in_progress when the ten-call GitHub budget was exhausted (seven calls were used on the brief's older f207 discovery/failed logs). No green from another SHA is substituted, and no generated-view exemption is claimed without a completed result and failure evidence.

The fleet must fetch the pushed branch and rerun/observe its independent exact-SHA gate. The source-only inherited view drift was independently recorded locally; the lander generates those views from merged CONTRACT.md. This is separate from the unresolved f207 suspension reference and does not establish that candidate's missing seven assertion repairs.
