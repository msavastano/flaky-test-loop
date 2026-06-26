'use strict';

function add(a, b) {
  return a + b;
}

function clamp(value, min, max) {
  if (min > max) {
    throw new RangeError('min must be <= max');
  }
  return Math.min(Math.max(value, min), max);
}

function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = { add, clamp, slugify };
