const assert = require("node:assert/strict");
const test = require("node:test");
const { stripAnsi, visibleLength, wrapAnsi } = require("../src/ansi");

test("wrapAnsi preserves the full text across terminal rows", () => {
  const lines = wrapAnsi("abcdefghij", 4);

  assert.deepEqual(lines.map(stripAnsi), ["abcd", "efgh", "ij"]);
});

test("wrapAnsi carries active colours onto wrapped rows", () => {
  const lines = wrapAnsi("\u001b[31mabcdef\u001b[0m", 3);

  assert.equal(lines.length, 2);
  assert.match(lines[1], /^\u001b\[31m/);
  assert.deepEqual(lines.map(stripAnsi), ["abc", "def"]);
});

test("visibleLength ignores ANSI styling", () => {
  assert.equal(visibleLength("\u001b[32mgreen\u001b[0m"), 5);
});