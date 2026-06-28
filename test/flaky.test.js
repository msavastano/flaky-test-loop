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
// Previously a single module-level `let sharedCounter = 0` was read, then
// awaited across a random setTimeout, then written, while both (a) and (b) ran
// concurrently via test.concurrent. The await let the two tests interleave the
// read-modify-write, so `sharedCounter - before` was not reliably 1.
//
// Real fix: give each test its own isolated counter (no shared module state),
// so there is nothing left for another concurrently-running test to mutate
// between this test's read and write, regardless of await ordering.
function makeCounter() {
  return { value: 0 };
}

test.concurrent('order: counter increments exactly once between read and write (a)', async () => {
  const counter = makeCounter();
  const before = counter.value;
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
  counter.value += 1;
  expect(counter.value - before).toBe(1);
});

test.concurrent('order: counter increments exactly once between read and write (b)', async () => {
  const counter = makeCounter();
  const before = counter.value;
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
  counter.value += 1;
  expect(counter.value - before).toBe(1);
});

// --- Flake 3: nondeterministic input in the assertion path --------------------
// Date.now() is read directly inside the assertion, so the outcome depends on the
// wall-clock instant the test happens to run at. Real fix: inject/mock the clock
// instead of asserting on a live nondeterministic value.
test('nondeterministic: current millisecond timestamp is even', () => {
  const ts = Date.now();
  expect(ts % 2).toBe(0);
});
