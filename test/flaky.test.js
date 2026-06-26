'use strict';

// Deliberately flaky tests. Each is flaky for a DIFFERENT real-world reason so the
// flake-triage loop has variety to classify. Root causes are documented inline —
// do not "fix" these by deleting assertions; that is exactly the fake-fix the
// evaluator agent (.claude/agents/flake-reviewer.md) exists to reject.

// --- Flake 1: timing/race -----------------------------------------------------
// Two independent setTimeout calls race each other with a margin too tight to be
// reliable. Real fix: inject a controllable clock (jest fake timers) or await the
// worker directly instead of racing wall-clock timers.
function unstableWorker() {
  return new Promise((resolve) => {
    setTimeout(() => resolve('done'), 2 + Math.random() * 4);
  });
}

test('race: worker timer narrowly beats the deadline timer', async () => {
  const result = await Promise.race([
    unstableWorker(),
    new Promise((resolve) => setTimeout(() => resolve('timeout'), 4)),
  ]);
  expect(result).toBe('done');
});

// --- Flake 2: order-dependent / shared mutable module state -------------------
// Module-level counter is read-modify-written by concurrently running tests with
// no isolation or reset. Real fix: give each test its own state, or make the
// increment atomic (no `await` between read and write).
let sharedCounter = 0;

test.concurrent('order: counter increments exactly once between read and write (a)', async () => {
  const before = sharedCounter;
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
  sharedCounter += 1;
  expect(sharedCounter - before).toBe(1);
});

test.concurrent('order: counter increments exactly once between read and write (b)', async () => {
  const before = sharedCounter;
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
  sharedCounter += 1;
  expect(sharedCounter - before).toBe(1);
});

// --- Flake 3: nondeterministic input in the assertion path --------------------
// Date.now() is read directly inside the assertion, so the outcome depends on the
// wall-clock instant the test happens to run at. Real fix: inject/mock the clock
// instead of asserting on a live nondeterministic value.
test('nondeterministic: current millisecond timestamp is even', () => {
  const ts = Date.now();
  expect(ts % 2).toBe(0);
});
