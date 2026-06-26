'use strict';

const { add, clamp, slugify } = require('../src/index');

describe('add', () => {
  test('adds two positive numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  test('adds negative numbers', () => {
    expect(add(-2, -3)).toBe(-5);
  });
});

describe('clamp', () => {
  test('clamps below range', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  test('clamps above range', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  test('passes through in-range value', () => {
    expect(clamp(4, 0, 10)).toBe(4);
  });

  test('throws when min > max', () => {
    expect(() => clamp(1, 10, 0)).toThrow(RangeError);
  });
});

describe('slugify', () => {
  test('lowercases and hyphenates', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  test('strips punctuation', () => {
    expect(slugify('  Foo, Bar!! ')).toBe('foo-bar');
  });
});
