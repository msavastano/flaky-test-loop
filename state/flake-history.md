# Flake history

Cross-round memory for the flake-triage loop. The agent running this skill has no
memory of prior rounds except what's written here — this file IS that memory.
Appended to (never rewritten) by the `flake-triage` skill's Write step, and
committed back to the repo every round.

| test | file | flake-rate | suspected-cause | status |
|---|---|---|---|---|
| race: worker timer narrowly beats the deadline timer | test/flaky.test.js | 6/10 | timing/race | active |
| order: counter increments exactly once between read and write (a) | test/flaky.test.js | 7/10 | order-dependent/shared-state | active |
| order: counter increments exactly once between read and write (b) | test/flaky.test.js | 3/10 | order-dependent/shared-state | active |
| nondeterministic: current millisecond timestamp is even | test/flaky.test.js | 6/10 | nondeterministic-input | active |

<!--
Round 1 notes:
- 4 genuine flakes found in test/flaky.test.js; cap is 5, so 0 deferred.
- (a) and (b) share one root cause (module-level sharedCounter under
  test.concurrent), so both map to a single worktree/slug: order-shared-counter.
- Slugs: race-worker-timer, order-shared-counter, nondeterministic-timestamp.
- NOISE: a stale nested git worktree (.claude/worktrees/modest-brown-b3bf96,
  branch claude/modest-brown-b3bf96) is scanned by jest testMatch '**/test/**',
  producing duplicate rows in run-suite-n output (including a spurious 0/10 for
  test (b)). Triage based on canonical test/ only. Fix worktrees are siblings
  (../flaky-test-loop-worktrees/<slug>) and are NOT polluted by this.
-->

