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

test("stops an interactive run after one quit request", async () => {
  const output = new PassThrough();
  output.isTTY = true;
  output.columns = 80;
  output.rows = 10;
  const input = new PassThrough();
  input.isTTY = true;
  const rawModes = [];
  input.setRawMode = (enabled) => rawModes.push(enabled);
  let captured = "";
  let markReady;
  const ready = new Promise((resolve) => {
    markReady = resolve;
  });
  output.on("data", (chunk) => {
    captured += chunk.toString("utf8");
    if (captured.includes("ready")) {
      markReady();
    }
  });

  const startedAt = Date.now();
  const result = runPaginated(
    [{
      name: "ONE",
      command: `${process.execPath} -e "console.log('ready'); setTimeout(() => {}, 1500)"`,
    }],
    { formatJsonLogs: false, input, output },
  );

  await ready;
  input.write("q");
  await result.catch(() => undefined);

  assert.ok(Date.now() - startedAt < 1000);
  assert.deepEqual(rawModes, [true, false]);
  assert.equal(input.isPaused(), true);
  assert.match(captured, /\u001b\[\?25h\u001b\[\?1049l/);
});