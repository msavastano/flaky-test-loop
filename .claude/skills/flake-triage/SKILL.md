---
name: flake-triage
description: Discover flaky tests by re-running the suite N times, classify each candidate as flake vs hard failure, persist findings, and hand off genuine flakes to per-test worktrees for fixing. Stop conditions are load-bearing — read them before touching any test.
---

# flake-triage

Discovery half of the flaky-test quarantine loop. This skill finds and classifies
candidates; it does **not** fix anything itself. Fixing is the generator agent's job
(`.claude/agents/flake-fixer.md`), and nothing it produces is trusted until the
evaluator agent (`.claude/agents/flake-reviewer.md`) verifies it by re-running the
suite, not by reading the diff.

## Read

1. Read `loop.config.json` for `suiteRunsPerCandidate` (default 10) and
   `maxFlakeCandidatesPerRound`. Let `N = suiteRunsPerCandidate`, or an explicit
   override if the caller passed one.
2. Run `node scripts/run-suite-n.js N` from the repo root. This re-runs the full
   Jest suite N times and reports per-test pass/fail counts as JSON on stdout (a
   human-readable summary goes to stderr). A test that is **neither all-pass nor
   all-fail** across the N runs is a flake candidate (`flakeCandidate: true` in the
   output).
3. If `./state/flake-history.md` exists, read it too. It carries forward
   flake-rate history and status (`active` / `quarantined` / `fixed`) from prior
   rounds — a candidate already marked `quarantined` there doesn't need a fresh
   worktree, and a candidate whose rate has been stable across rounds is stronger
   evidence than one round alone.

## Judge

This step sets the ceiling for everything downstream — get it wrong and the loop
either wastes a worktree on a real bug, or worse, quarantines (hides) a real bug.

For each flake candidate from Read:

- **Always fails (0/N pass)** — not a flake. This is a hard, deterministic failure:
  a real bug. Do NOT route it into the flake-fix flow. File it as a normal bug
  report instead (an inbox entry tagged `kind: bug`, not `kind: flake`) and stop
  processing it here.
- **Always passes (N/N pass)** — not a candidate; ignore.
- **Mixed (some pass, some fail)** — genuine flake. Check `flake-history.md`:
  - If already `status: quarantined`, leave it; don't re-open a worktree unless
    the user explicitly asks for a re-attempt.
  - If already `status: fixed` but it's flaking again, treat as a regression:
    re-open at a higher priority and note `regression` in the cause field.
  - Otherwise it's a new flake — keep it.
- Cap kept flakes at `maxFlakeCandidatesPerRound` (loop.config.json). If more
  qualify, keep the highest flake-rate ones (most reliably reproducible — easiest
  for the generator/evaluator to make progress on) and leave the rest for next
  round. Note the deferral count when you write history.

## Write

Append one row per judged candidate to `./state/flake-history.md`:

```
| test | file | flake-rate | suspected-cause | status |
```

- `flake-rate` — `pass/total` from this round (e.g. `4/10`).
- `suspected-cause` — short tag: `timing/race`, `order-dependent/shared-state`,
  `nondeterministic-input`, or `unknown` if you can't tell yet. Don't guess wildly;
  `unknown` is a legitimate value the generator agent can refine.
- `status` — `active` (new, awaiting a worktree), `quarantined`, `fixed`, or
  `deferred` (judged but over this round's cap).

Commit the updated file:

```
git add state/flake-history.md
git commit -m "flake-triage: record round results"
```

This file is the loop's cross-round memory (see PERSISTENCE in the README) — the
agent running next round has no memory of this one except what's written here.

## Hand off

For each candidate kept with `status: active`, emit one handoff line:

```
worktree=flake/<slug> goal=<stop-condition>
```

- `<slug>` — short kebab-case id for the test, stable across rounds (so the same
  flake always gets the same branch name; reuse the slug already in
  flake-history.md if this test has been seen before).
- `<stop-condition>` — concrete and checkable, e.g.: "all non-quarantined tests in
  test/flaky.test.js pass deterministically across 10 runs AND `npm run lint` is
  clean." Never a vague goal like "fix the flake."

Use `scripts/handoff.ps1` to actually create the worktree:

```powershell
./scripts/handoff.ps1 -Action create -Slug <slug>
```

Each worktree is isolated on branch `flake/<slug>` so parallel fix attempts for
different flakes never collide with each other or with main.

## Stop

These boundaries are load-bearing, not boilerplate. The loop cannot infer them from
the code, and violating any one of them produces exactly the failure mode this
whole repo exists to catch: a fake fix that looks green and silences a real bug.

- **NEVER delete a test.** A deleted test isn't a fixed flake, it's a removed
  guarantee.
- **NEVER weaken or remove an assertion to force green.** Loosening a tolerance,
  changing `toBe` to a no-op check, or asserting on something unrelated all count
  as weakening.
- **NEVER add bare `sleep`/timeout padding as a "fix."** Padding a race with a
  bigger delay hides the bug on this machine and reintroduces it on a slower CI
  runner. It is not a root-cause fix.
- **If the root cause can't be fixed with confidence**, the only permitted action
  is: tag the test `@flaky` (or equivalent skip annotation), skip it in the
  default run, and file a tracking entry in `./inbox/` with the suspected cause
  and what was tried. Quarantine is a holding cell, not a fix — it must be visible
  and reviewable, never silent.

Any output that violates one of the above is not a deliverable of this skill,
regardless of whether the suite goes green. The evaluator agent is specifically
designed to catch and reject these — see `.claude/agents/flake-reviewer.md`.
