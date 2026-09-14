const assert = require("node:assert/strict");
const test = require("node:test");
const { createJsonFormatter, isJson } = require("../src/json-formatter");

test("isJson identifies complete JSON values", () => {
  assert.equal(isJson('{"ok":true}'), true);
  assert.equal(isJson("not-json {broken"), false);
});

test("disabled formatting returns the original line", () => {
  const format = createJsonFormatter({ enabled: false });
  const line = '{"compact":true}';

  assert.deepEqual(format(line), [line]);
});

test("missing jq returns the original line", () => {
  const format = createJsonFormatter({ jqCommand: "jq-command-that-does-not-exist" });
  const line = '{"compact":true}';

  assert.deepEqual(format(line), [line]);
});

test("available jq formats valid JSON into multiple lines", () => {
  const calls = [];
  const runCommand = (command, args, options) => {
    calls.push({ command, args, options });

    if (args[0] === "--version") {
      return { status: 0 };
    }

    return { status: 0, stdout: "{\n  \"ok\": true\n}\n" };
  };
  const format = createJsonFormatter({ runCommand });

  assert.deepEqual(format('{"ok":true}'), ["{", '  "ok": true', "}"]);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].args, ["--color-output", "."]);
});

test("jq is not invoked for invalid JSON", () => {
  let calls = 0;
  const runCommand = () => {
    calls += 1;
    return { status: 0, stdout: "unexpected" };
  };
  const format = createJsonFormatter({ runCommand });

  assert.deepEqual(format("not-json {broken"), ["not-json {broken"]);
  assert.equal(calls, 1);
});