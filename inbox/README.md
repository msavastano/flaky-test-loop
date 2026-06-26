# inbox/

Landing zone for things the loop could not resolve with confidence on its own:

- **Quarantined flakes** — a test tagged `@flaky`/skipped because the root cause
  couldn't be fixed with confidence. One file per flake: `<slug>.md`.
- **Low-confidence fixes** — a fix the generator made but isn't sure addresses the
  real root cause, flagged for human review instead of being merged on faith.
- **Hard failures misrouted from triage** — a candidate that turned out to be an
  always-failing test (a real bug, not a flake), filed here as `kind: bug` so it
  doesn't get lost.

This directory is read by humans, not by the loop. Nothing in here auto-resolves;
see the README's HUMAN REVIEW section — this door is permanent, not scaffolding.

## Entry format

```markdown
---
slug: <slug>
kind: flake | bug | low-confidence-fix
test: <full Jest test name>
file: <test file path>
suspected-cause: timing/race | order-dependent/shared-state | nondeterministic-input | unknown
status: quarantined | needs-review
---

What was tried, what was ruled out, and why confidence was too low to land a fix
or close it out automatically.
```
