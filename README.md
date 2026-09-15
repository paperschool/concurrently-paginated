# concurrently-paginated

[![npm version](https://img.shields.io/npm/v/concurrently-paginated?logo=npm)](https://www.npmjs.com/package/concurrently-paginated)
[![npm downloads](https://img.shields.io/npm/dm/concurrently-paginated?logo=npm)](https://www.npmjs.com/package/concurrently-paginated)
[![Node.js](https://img.shields.io/node/v/concurrently-paginated?logo=node.js)](https://www.npmjs.com/package/concurrently-paginated)
[![License](https://img.shields.io/npm/l/concurrently-paginated)](https://www.npmjs.com/package/concurrently-paginated)

A keyboard-navigable terminal UI for [`concurrently`](https://www.npmjs.com/package/concurrently). Each command gets its own buffered log history, while the active command title and compact tab bar remain fixed on screen.

<table>
  <tr>
    <td><img src="https://raw.githubusercontent.com/paperschool/concurrently-paginated/main/docs/all.png" alt="All commands live output view" width="100%"></td>
    <td><img src="https://raw.githubusercontent.com/paperschool/concurrently-paginated/main/docs/search.png" alt="Command history search view" width="100%"></td>
    <td><img src="https://raw.githubusercontent.com/paperschool/concurrently-paginated/main/docs/help.png" alt="Keyboard shortcuts view" width="100%"></td>
  </tr>
</table>

## Capabilities

- Run multiple long-lived development commands through `concurrently`.
- Keep an independent, bounded history for every command.
- Browse an arrival-ordered `ALL` view across all command output.
- Search and highlight matches in command histories.
- Highlight search matches live as you type.
- Navigate with tabs, arrow keys, paging, numeric shortcuts, and live-follow mode.
- Open a formatted keyboard-shortcuts view with `?`.
- Preserve child-process ANSI colours and wrap long lines without dropping content.
- Format complete JSON log lines with optional `jq` colour output.
- Fall back to prefixed streaming output in CI, redirected, and non-TTY environments.
- Preserve command-specific lifecycle, restart, environment, and working-directory options.

## Install

```sh
npm install --save-dev concurrently-paginated
```

## Inline CLI

```json
{
  "scripts": {
    "dev": "concurrently-paginated --names PROXY,SERVER,CLIENT \"npm run proxy\" \"npm run server\" \"npm run client\""
  }
}
```

The shorter `concp` binary is also available.

```sh
concp -n PROXY,SERVER "npm run proxy" "npm run server"
```

## Bootstrap File

Create a regular JavaScript file when command-specific options are easier to maintain outside `package.json`:

```js
const { runPaginated } = require("concurrently-paginated");

runPaginated(
  [
    { name: "PROXY", command: "npm run proxy" },
    { name: "SERVER", command: "npm run server", env: { PORT: "4000" } },
    { name: "CLIENT", command: "npm run client" },
  ],
  {
    concurrently: {
      killOthersOn: ["failure", "success"],
      restartTries: 3,
    },
    formatJsonLogs: true,
    maxBufferLines: 2000,
  },
).catch(() => {
  process.exitCode = 1;
});
```

Then call it from `package.json`:

```json
{
  "scripts": {
    "dev": "node scripts/dev.js"
  }
}
```

## Run The Example

To try the interactive UI from a checkout, run:

```sh
npm run example
```

The demo simulates a small workspace with API traffic, worker queue batches, frontend rebuilds, database activity, and auth events. It includes coloured lifecycle messages, structured JSON lines, warnings, and completion states across `API`, `WORKER`, `WEB`, `DATABASE`, and `AUTH`. Use `/` to search, `n`/`N` to move between matches, and `Tab` or the arrow keys to visit the `ALL` tab.

Command objects and `concurrently` options follow the upstream programmatic API.

## Controls

| Key                    | Action                                    |
| ---------------------- | ----------------------------------------- |
| `/`                    | Start live search in the selected history |
| `Enter`, `Esc`         | Exit search entry mode                    |
| `n`, `N`               | Go to the next or previous search match   |
| `?`                    | Show keyboard shortcuts                   |
| `Tab`, `Left`, `Right` | Switch command or the `ALL` view          |
| `1`-`9`                | Jump to a command                         |
| `Up`, `Down`           | Scroll log history                        |
| `Page Up`, `Page Down` | Scroll one page                           |
| `End`                  | Return to live output                     |
| `q`, `Ctrl+Q`, `Ctrl+C` | Stop all commands                        |

Long lines wrap without losing content. ANSI colours emitted by child commands are preserved.

### Optional JSON Formatting With jq

When [`jq`](https://jqlang.github.io/jq/) is installed, each complete JSON log line is validated and formatted with `jq --color-output .`. For example, a line such as:

```json
{"service":"api","requests":42,"healthy":true}
```

is rendered as readable, colourised JSON in the selected command history. Ordinary text, invalid JSON, missing `jq`, and formatter failures are passed through unchanged. `jq` is never required to run the utility.

Install `jq` with your package manager if you want this enhancement:

```sh
# macOS
brew install jq

# Debian or Ubuntu
sudo apt-get install jq
```

Disable formatting from the CLI with `--no-json`, or through the API with `formatJsonLogs: false`:

```js
runPaginated(commands, {
  formatJsonLogs: false,
});
```

The API also accepts `jqCommand` when `jq` is installed under a custom name or path. Formatting runs once per complete JSON line; non-JSON output does not spawn a formatter process.

During search entry, the title bar turns orange and shows the current `search: <input>` value; matches highlight immediately as text is entered. Press Enter or Escape to return to the normal title bar. The `?` shortcut replaces the view with a formatted shortcut list until any key is pressed.

The `ALL` tab keeps a bounded, chronological view of output from every command. Each entry is labelled with its source command and retains that command's colour. Search highlights matches in the selected command or in `ALL`, and `n`/`N` cycles through the results while preserving the current history position.

When stdout is redirected or no interactive TTY is available, output falls back to conventional prefixed streaming logs.

## Versioning

Releases follow [Semantic Versioning](https://semver.org/). Release notes are maintained in [CHANGELOG.md](CHANGELOG.md). To prepare a release, update the changelog, run `npm test`, `npm run lint`, and `npm pack --dry-run`, then use `npm version <major|minor|patch>` to create the package version commit and tag.

## Disclaimer

This project is currently developed and tested primarily on macOS. Other platforms are not officially supported yet and may have terminal, ANSI, shell, or process-lifecycle compatibility issues.

## Authors

Created and maintained by [Dominic Jomaa](https://www.linkedin.com/in/dominicjomaa/).

[LinkedIn](https://www.linkedin.com/in/dominicjomaa/) • [Instagram](https://www.instagram.com/ono.sendai.runner/)

## Funding

If `concurrently-paginated` is useful to you, you can support its development through the options in [FUNDING.md](.github/FUNDING.yml).