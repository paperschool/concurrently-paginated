const concurrently = require("concurrently");
const { Readable, Writable } = require("node:stream");
const { createJsonFormatter } = require("./json-formatter");
const { OutputRouter } = require("./output-router");
const { PaginatedRenderer } = require("./renderer");

const discardOutput = new Writable({
  write(chunk, encoding, callback) {
    callback();
  },
});

function runPaginated(commands, options = {}) {
  if (!Array.isArray(commands) || commands.length === 0) {
    throw new TypeError("runPaginated requires at least one command");
  }

  const input = options.input || process.stdin;
  const output = options.output || process.stdout;
  const interactive = Boolean(input.isTTY && output.isTTY && input.setRawMode);
  const formatJson = createJsonFormatter({
    enabled: options.formatJsonLogs !== false,
    jqCommand: options.jqCommand,
  });
  const normalizedCommands = commands.map((command, index) =>
    normalizeCommand(command, index, interactive),
  );
  const renderer = interactive
    ? new PaginatedRenderer(normalizedCommands, {
        input,
        maxBufferLines: options.maxBufferLines,
        output,
      })
    : null;
  const outputRouter = new OutputRouter((index, line) => {
    formatJson(line).forEach((formatted) => {
      if (renderer) {
        renderer.append(index, formatted);
      } else {
        output.write(`${normalizedCommands[index].name} ${formatted}\n`);
      }
    });
  });
  const logger = new concurrently.Logger({
    hide: [],
    prefixFormat: "none",
    raw: true,
  });
  const loggerSubscription = logger.output.subscribe(({ command, text }) => {
    outputRouter.write(command.index, text);
  });
  const runner = concurrently(normalizedCommands, {
    ...options.concurrently,
    logger,
    outputStream: discardOutput,
    inputStream: Readable.from([]),
    handleInput: false,
    raw: false,
  });

  if (!interactive) {
    return runner.result.finally(() => {
      outputRouter.flush();
      loggerSubscription.unsubscribe();
    });
  }

  let stopped = false;
  let runnerResult;
  let runnerError;
  let runnerFinished = false;
  let cleanup;

  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    runner.commands.forEach((command) => {
      if (command.stdin) {
        command.stdin.end();
      }
      command.kill("SIGTERM");
    });
    if (runnerFinished) {
      cleanup();
    }
  };

  attachStatuses(runner.commands, renderer);
  renderer.start(stop);

  return new Promise((resolve, reject) => {
    cleanup = () => {
      outputRouter.flush();
      loggerSubscription.unsubscribe();
      renderer.stop();
      if (runnerError) {
        reject(runnerError);
      } else {
        resolve(runnerResult);
      }
    };

    runner.result.then(
      (result) => {
        runnerFinished = true;
        runnerResult = result;
        if (stopped) {
          cleanup();
        }
      },
      (error) => {
        runnerFinished = true;
        runnerError = error;
        if (stopped) {
          cleanup();
        }
      },
    );
  });
}

function normalizeCommand(command, index, interactive) {
  const normalized =
    typeof command === "string"
      ? { command, name: `command-${index + 1}` }
      : { ...command, name: command.name || `command-${index + 1}` };

  if (!interactive) {
    return normalized;
  }

  return {
    ...normalized,
    env: {
      ...normalized.env,
      FORCE_COLOR: normalized.env?.FORCE_COLOR || process.env.FORCE_COLOR || "1",
    },
  };
}

function attachStatuses(commands, renderer) {
  commands.forEach((command, index) => {
    command.close.subscribe(({ exitCode }) => {
      renderer.setStatus(index, `exit ${exitCode}`);
    });
  });
}

module.exports = runPaginated;
module.exports.runPaginated = runPaginated;