const assert = require("node:assert/strict");
const test = require("node:test");
const { PassThrough } = require("node:stream");
const { stripAnsi } = require("../src/ansi");
const { PaginatedRenderer } = require("../src/renderer");

function createRenderer() {
  const output = new PassThrough();
  output.columns = 80;
  output.rows = 10;

  return new PaginatedRenderer(
    [{ name: "ONE" }, { name: "TWO" }],
    { maxBufferLines: 10, output },
  );
}

test("keeps an arrival-order history in the ALL tab", () => {
  const renderer = createRenderer();

  renderer.append(1, "second");
  renderer.append(0, "first");
  renderer.select(2);

  assert.equal(renderer.selectedState.name, "ALL");
  assert.deepEqual(
    renderer.currentLogs.map((entry) => [entry.index, entry.line]),
    [
      [1, "second"],
      [0, "first"],
    ],
  );
  assert.match(stripAnsi(renderer.formatLog(renderer.currentLogs[0])), /TWO second/);
});

test("searches the selected history and cycles matches", () => {
  const renderer = createRenderer();

  renderer.append(0, "build started");
  renderer.append(0, "build finished");
  renderer.finishSearch("build");

  assert.equal(renderer.searchMatches.length, 2);
  assert.equal(renderer.searchMatchIndex, 0);
  assert.match(renderer.highlight("build started"), /\u001b\[7mbuild\u001b\[0m/);

  renderer.nextSearchMatch(1);
  assert.equal(renderer.searchMatchIndex, 1);
  renderer.nextSearchMatch(1);
  assert.equal(renderer.searchMatchIndex, 0);
});