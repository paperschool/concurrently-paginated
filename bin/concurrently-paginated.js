#!/usr/bin/env node

const { runPaginated } = require("../src");

const { commands, options } = parseArguments(process.argv.slice(2));

if (options.help || commands.length === 0) {
  printHelp();
  process.exit(commands.length === 0 && !options.help ? 1 : 0);
}

runPaginated(commands, options)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

function parseArguments(args) {
  const options = { concurrently: {} };
  let names = [];
  const commands = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else if (argument === "--names" || argument === "-n") {
      names = (args[index + 1] || "").split(",");
      index += 1;
    } else if (argument === "--no-json") {
      options.formatJsonLogs = false;
    } else if (argument === "--max-buffer-lines") {
      options.maxBufferLines = Number(args[index + 1]);
      index += 1;
    } else if (argument === "--kill-others") {
      options.concurrently.killOthersOn = ["failure", "success"];
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      commands.push({
        command: argument,
        name: names[commands.length] || `command-${commands.length + 1}`,
      });
    }
  }

  return { commands, options };
}

function printHelp() {
  console.log(`Usage: concurrently-paginated [options] "command" "command"

Options:
  -n, --names <names>       Comma-separated command names
  --kill-others             Stop all commands when one exits
  --max-buffer-lines <n>    Buffered logical lines per command (default: 1000)
  --no-json                 Disable optional jq JSON formatting
  -h, --help                Show this help

Controls:
  /                         Start a search in the selected history
  n / N                     Go to the next / previous search match
  Tab / Left / Right        Switch commands or the ALL view
  Up / Down                 Scroll selected command
  Page Up / Page Down       Scroll one page
  End                       Return to live output
  q / Ctrl+C                Stop all commands`);
}

module.exports = { parseArguments };