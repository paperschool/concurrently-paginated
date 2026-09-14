const { spawnSync } = require("node:child_process");

function commandExists(command, runCommand) {
  const result = runCommand(command, ["--version"], { stdio: "ignore" });

  return !result.error && result.status === 0;
}

function createJsonFormatter({
  enabled = true,
  jqCommand = "jq",
  runCommand = spawnSync,
} = {}) {
  const jqAvailable = enabled && commandExists(jqCommand, runCommand);

  return function formatJson(line) {
    if (!jqAvailable || !isJson(line)) {
      return [line];
    }

    const result = runCommand(jqCommand, ["--color-output", "."], {
      encoding: "utf8",
      input: line,
      maxBuffer: 1024 * 1024,
    });

    if (result.error || result.status !== 0 || !result.stdout) {
      return [line];
    }

    return result.stdout.replace(/\r?\n$/, "").split(/\r?\n/);
  };
}

function isJson(line) {
  try {
    JSON.parse(line);
    return true;
  } catch {
    return false;
  }
}

module.exports = { createJsonFormatter, isJson };