const assert = require("node:assert/strict");
const test = require("node:test");
const { OutputRouter } = require("../src/output-router");

test("routes prefixed output to its command index", () => {
  const lines = [];
  const router = new OutputRouter((index, line) => lines.push({ index, line }));

  router.write(1, "hello\n");
  router.write(0, "world\n");

  assert.deepEqual(lines, [
    { index: 1, line: "hello" },
    { index: 0, line: "world" },
  ]);
});

test("preserves partial output until flush", () => {
  const lines = [];
  const router = new OutputRouter((index, line) => lines.push({ index, line }));

  router.write(0, "partial");
  assert.deepEqual(lines, []);
  router.flush();

  assert.deepEqual(lines, [{ index: 0, line: "partial" }]);
});