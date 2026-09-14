const assert = require("node:assert/strict");
const test = require("node:test");
const { PassThrough } = require("node:stream");
const { runPaginated } = require("../src");

test("streams prefixed output when no TTY is available", async () => {
  const output = new PassThrough();
  let captured = "";
  output.on("data", (chunk) => {
    captured += chunk.toString("utf8");
  });

  await runPaginated(
    [{ name: "ONE", command: `${process.execPath} -e "console.log('hello')"` }],
    { formatJsonLogs: false, output },
  );

  assert.equal(captured, "ONE hello\n");
});

test("rejects an empty command list", () => {
  assert.throws(() => runPaginated([]), /at least one command/);
});

test("keeps terminal input out of child process input forwarding", async () => {
  const output = new PassThrough();
  const input = new PassThrough();
  input.isTTY = false;

  await runPaginated(
    [{ name: "ONE", command: `${process.execPath} -e "console.log('ready')"` }],
    { formatJsonLogs: false, input, output, concurrently: { handleInput: true } },
  );

  assert.match(output.read()?.toString("utf8") || "", /ONE ready/);
});