# GitHub observation budget

Six CLI invocations inspected the original exact-SHA failure: one actions/runs discovery, one jobs list, and one gh run view --job --log-failed invocation for each of four failed jobs. A seventh invocation discovered the first repair run 42520155621; its watcher was stopped before any polling when the browser counterpart of the same cleanup contradiction was found. One final watcher observes only final head 5b5292f80ce0b391e972787c338489c04e40af3d, with an initial wait to avoid spending the remaining three calls while CI is expected to run and at least 300 seconds between subsequent observations. No PR API calls or direct job-log blob retries were made.

Final usage: 10 CLI invocations. Final run discovery and one status poll used calls eight and nine. The single whole failed-run archive command used call ten; no more workflow/API calls were made.
