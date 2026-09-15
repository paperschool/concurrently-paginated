const readline = require("node:readline");
const packageVersion = require("../package.json").version;
const {
  BOLD,
  DIM,
  ENTER_ALTERNATE_SCREEN,
  FLASH_TAB_FOREGROUND,
  LEAVE_ALTERNATE_SCREEN,
  REVERSE,
  RESET,
  SELECTED_TAB_BACKGROUND,
  SELECTED_TAB_FOREGROUND,
  SEARCH_BACKGROUND,
  SEARCH_FOREGROUND,
  TAB_FOREGROUND,
  STATUS_BACKGROUND,
  stripTerminalControls,
  taskColour,
  visibleLength,
  wrapAnsi,
} = require("./ansi");

class PaginatedRenderer {
  constructor(commands, options = {}) {
    this.input = options.input || process.stdin;
    this.output = options.output || process.stdout;
    this.maxBufferLines = options.maxBufferLines || 1000;
    this.states = commands.map((command, index) => ({
      buffer: [],
      index,
      name: command.name || `command-${index + 1}`,
      running: true,
      scrollOffset: 0,
      maxScrollOffset: 0,
      status: "running",
      flashUntil: 0,
    }));
    this.allState = {
      buffer: [],
      index: this.states.length,
      name: "ALL",
      running: true,
      scrollOffset: 0,
      maxScrollOffset: 0,
      status: "live",
    };
    this.selectedIndex = 0;
    this.searchMode = false;
    this.searchInput = "";
    this.searchQuery = "";
    this.searchMatches = [];
    this.searchMatchIndex = -1;
    this.helpMode = false;
    this.pendingInput = "";
    this.inputSequenceTimer = null;
    this.renderQueued = false;
    this.started = false;
    this.scrollRepeatCount = 0;
    this.lastScrollDirection = 0;
    this.lastScrollAt = 0;
  }

  start(onQuit) {
    this.onQuit = onQuit;
    this.input.setRawMode(true);
    this.input.resume();
    this.input.on("data", this.handleInput);
    this.output.on("resize", this.handleResize);
    this.output.write(ENTER_ALTERNATE_SCREEN);
    this.started = true;
    this.render();
  }

  stop() {
    this.started = false;
    clearTimeout(this.inputSequenceTimer);
    this.inputSequenceTimer = null;
    this.input.off("data", this.handleInput);
    this.output.off("resize", this.handleResize);
    this.input.setRawMode(false);
    this.input.pause();
    this.output.write(LEAVE_ALTERNATE_SCREEN);
  }

  append(index, line) {
    const state = this.states[index];
    line = stripTerminalControls(line);
    state.buffer.push(line);
    this.allState.buffer.push({ index, line });

    if (this.started && index !== this.selectedIndex) {
      state.flashUntil = Date.now() + 250;
      setTimeout(() => {
        if (state.flashUntil <= Date.now() && this.started) {
          this.queueRender();
        }
      }, 275);
    }

    const visualLineCount = wrapAnsi(line, this.width).length;
    if (state.scrollOffset > 0) {
      state.scrollOffset += visualLineCount;
    }
    if (this.allState.scrollOffset > 0) {
      this.allState.scrollOffset += visualLineCount;
    }

    if (state.buffer.length > this.maxBufferLines) {
      state.buffer.shift();
    }
    if (this.allState.buffer.length > this.maxBufferLines) {
      this.allState.buffer.shift();
    }
    if (this.searchQuery) {
      this.searchMatches = this.findSearchMatches();
    }

    if (this.started) {
      this.queueRender();
    }
  }

  setStatus(index, status) {
    this.states[index].running = false;
    this.states[index].status = status;
    if (this.started) {
      this.queueRender();
    }
  }

  handleInput = (data) => {
    this.pendingInput += data.toString("utf8");
    this.consumeInput();
  };

  consumeInput() {
    while (this.pendingInput) {
      if (this.pendingInput.startsWith("\u001b")) {
        const sequence = this.pendingInput.match(/^\u001b\[[0-9;?]*[ -\/]*[@-~]/);

        if (sequence) {
          this.pendingInput = this.pendingInput.slice(sequence[0].length);
          this.processInputKey(sequence[0]);
          continue;
        }

        if (
          this.pendingInput === "\u001b" ||
          /^\u001b\[[0-9;?]*[ -\/]*$/.test(this.pendingInput)
        ) {
          this.deferEscapeInput();
          return;
        }
      }

      const [key] = Array.from(this.pendingInput);
      this.pendingInput = this.pendingInput.slice(key.length);
      this.processInputKey(key);
    }
  }

  deferEscapeInput() {
    clearTimeout(this.inputSequenceTimer);
    this.inputSequenceTimer = setTimeout(() => {
      if (this.pendingInput === "\u001b") {
        this.pendingInput = "";
        this.processInputKey("\u001b");
      }
    }, 25);
  }

  processInputKey(key) {
    if (this.helpMode) {
      this.helpMode = false;
      this.render();
      return;
    }

    if (this.searchMode) {
      this.handleSearchInput(key);
      return;
    }

    if (key === "\u0003" || key === "\u0011" || key.toLowerCase() === "q") {
      if (this.onQuit) {
        this.onQuit();
      }
    } else if (key === "/" || key.toLowerCase() === "s") {
      this.beginSearch();
    } else if (key === "?") {
      this.helpMode = true;
      this.render();
    } else if (key === "n") {
      this.nextSearchMatch(1);
    } else if (key === "N") {
      this.nextSearchMatch(-1);
    } else if (key === "\t" || key === "\u001b[C") {
      this.select(this.selectedIndex + 1);
    } else if (key === "\u001b[Z" || key === "\u001b[D") {
      this.select(this.selectedIndex - 1);
    } else if (key === "\u001b[A") {
      this.scrollBy(this.acceleratedScrollAmount(1));
    } else if (key === "\u001b[B") {
      this.scrollBy(this.acceleratedScrollAmount(-1));
    } else if (key === "\u001b[5~") {
      this.scrollBy(this.visibleLineCount);
    } else if (key === "\u001b[6~") {
      this.scrollBy(-this.visibleLineCount);
    } else if (key === "\u001b[F" || key === " ") {
      this.scrollToLatest();
    } else if (/^[1-9]$/.test(key)) {
      const index = Number(key) - 1;

      if (this.states[index]) {
        this.selectedIndex = index;
        this.render();
      }
    }
  }

  handleResize = () => this.render();

  select(index) {
    this.selectedIndex = (index + this.tabCount) % this.tabCount;
    this.searchMode = false;
    this.searchInput = "";
    if (this.searchQuery) {
      this.searchMatches = this.findSearchMatches();
      this.searchMatchIndex = this.searchMatches.length > 0 ? 0 : -1;
    }
    this.render();
  }

  beginSearch() {
    this.searchMode = true;
    this.searchInput = "";
    this.searchQuery = "";
    this.searchMatches = [];
    this.searchMatchIndex = -1;
    this.render();
  }

  handleSearchInput(key) {
    if (key === "\u001b[A") {
      this.nextSearchMatch(-1);
    } else if (key === "\u001b[B") {
      this.nextSearchMatch(1);
    } else if (key === "\u001b[5~") {
      this.scrollBy(this.visibleLineCount);
    } else if (key === "\u001b[6~") {
      this.scrollBy(-this.visibleLineCount);
    } else if (key === "\u001b") {
      this.searchMode = false;
      this.render();
    } else if (key === "\r" || key === "\n") {
      this.searchMode = false;
      this.render();
    } else if (key === "\u007f" || key === "\b") {
      this.searchInput = this.searchInput.slice(0, -1);
      this.updateSearchQuery();
      this.render();
    } else if (key.length === 1 && key >= " ") {
      this.searchInput += key;
      this.updateSearchQuery();
      this.render();
    }
  }

  updateSearchQuery() {
    this.searchQuery = this.searchInput;
    this.searchMatches = this.findSearchMatches();
    this.searchMatchIndex = this.searchMatches.length > 0 ? 0 : -1;
    this.focusSearchMatch();
  }

  finishSearch(query) {
    this.searchInput = query;
    this.updateSearchQuery();
    this.searchMode = false;
    this.render();
  }

  nextSearchMatch(direction) {
    if (!this.searchQuery || this.searchMatches.length === 0) {
      return;
    }

    this.searchMatchIndex =
      (this.searchMatchIndex + direction + this.searchMatches.length) %
      this.searchMatches.length;
    this.focusSearchMatch();
    this.render();
  }

  findSearchMatches() {
    if (!this.searchQuery) {
      return [];
    }

    const query = this.searchQuery.toLowerCase();
    return this.currentLogs
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.line.toLowerCase().includes(query));
  }

  focusSearchMatch() {
    const match = this.searchMatches[this.searchMatchIndex];
    if (!match) {
      return;
    }

    const lines = this.visualLines();
    const target = this.visualLineIndex(match.index);
    this.selectedState.scrollOffset = Math.max(
      lines.length - target - this.visibleLineCount,
      0,
    );
  }

  visualLineIndex(logicalIndex) {
    return this.currentLogs
      .slice(0, logicalIndex)
      .reduce(
        (count, entry) =>
          count + wrapAnsi(this.formatLog(entry), this.width).length,
        0,
      );
  }

  scrollBy(amount) {
    const state = this.selectedState;
    const maxOffset = Math.max(
      this.visualLines(state).length - this.visibleLineCount,
      0,
    );
    state.maxScrollOffset = maxOffset;
    state.scrollOffset = Math.min(
      Math.max(state.scrollOffset + amount, 0),
      maxOffset,
    );
    this.renderAfterInput();
  }

  scrollToLatest() {
    this.selectedState.scrollOffset = 0;
    this.resetScrollAcceleration();
    this.renderAfterInput();
  }

  acceleratedScrollAmount(direction, now = Date.now()) {
    if (direction !== this.lastScrollDirection || now - this.lastScrollAt > 150) {
      this.scrollRepeatCount = 0;
    }

    this.scrollRepeatCount += 1;
    this.lastScrollDirection = direction;
    this.lastScrollAt = now;
    const multiplier = 2 ** Math.min(Math.floor((this.scrollRepeatCount - 1) / 4), 3);

    return direction * multiplier;
  }

  resetScrollAcceleration() {
    this.scrollRepeatCount = 0;
    this.lastScrollDirection = 0;
    this.lastScrollAt = 0;
  }

  renderAfterInput() {
    if (this.started) {
      this.queueRender();
    } else {
      this.render();
    }
  }

  queueRender() {
    if (this.renderQueued) {
      return;
    }

    this.renderQueued = true;
    setImmediate(() => {
      this.renderQueued = false;
      this.render();
    });
  }

  render() {
    if (this.helpMode) {
      this.renderHelp();
      return;
    }

    const state = this.selectedState;
    const lines = this.visualLines(state);
    state.maxScrollOffset = Math.max(lines.length - this.visibleLineCount, 0);
    state.scrollOffset = Math.min(state.scrollOffset, state.maxScrollOffset);
    const end = Math.max(lines.length - state.scrollOffset, 0);
    const start = Math.max(end - this.visibleLineCount, 0);

    readline.cursorTo(this.output, 0, 0);
    readline.clearScreenDown(this.output);
    this.renderLine(1, "");
    this.renderLogs(lines.slice(start, end));
    this.renderStatusBar();
    this.renderTitleBar();
  }

  renderLogs(lines) {
    const emptyRows = Math.max(this.visibleLineCount - lines.length, 0);
    const rows = [...Array(emptyRows).fill(""), ...lines];

    rows.forEach((line, index) => this.renderLine(index + 2, line));
  }

  renderTitleBar() {
    const background = this.searchMode ? SEARCH_BACKGROUND : STATUS_BACKGROUND;
    this.renderBar(0, this.titleBarText(), background);
  }

  titleText() {
    const state = this.selectedState;
    return ` ${state.name} - ${state.status} `;
  }

  titleBarText() {
    if (this.searchMode) {
      const title = ` search: ${this.searchInput}_ `;
      const matches = `match ${this.searchMatchIndex + 1}/${this.searchMatches.length}`;
      const padding = " ".repeat(
        Math.max(this.width - visibleLength(title) - visibleLength(matches), 1),
      );

      return `${SEARCH_FOREGROUND}${title}${padding}${DIM}${matches}${RESET}`;
    }

    const title = this.titleText();
    const history = this.historyPositionText();
    const padding = " ".repeat(
      Math.max(this.width - visibleLength(title) - visibleLength(history), 0),
    );

    return `${TAB_FOREGROUND}${title}${padding}${DIM}${history}${RESET}`;
  }

  historyPositionText() {
    const state = this.selectedState;
    if (state.scrollOffset === 0) {
      return "";
    }

    return `history ${state.scrollOffset}/${state.maxScrollOffset} `;
  }

  renderHelp() {
    const shortcuts = [
      ["Tab or Right", "Next view"],
      ["Shift+Tab or Left", "Previous view"],
      ["1-9", "Jump to command"],
      ["Up or Down", "Scroll history"],
      ["Page Up or Page Down", "Scroll one page"],
      ["Space or End", "Return to live output"],
      ["/ or s", "Start live search"],
      ["Up or Down", "Previous / next match (search)"],
      ["n or N", "Next / previous match"],
      ["Enter or Esc", "Apply / cancel search"],
      ["?", "Open / close this help"],
      ["q or Ctrl+Q or Ctrl+C", "Stop all commands"],
    ];

    readline.cursorTo(this.output, 0, 0);
    readline.clearScreenDown(this.output);
    this.renderBar(
      0,
      `${BOLD}${SELECTED_TAB_FOREGROUND} KEYBOARD SHORTCUTS ${RESET}`,
      SELECTED_TAB_BACKGROUND,
    );

    const columnWidth = Math.floor(this.width / 2);
    const rows = Math.ceil(shortcuts.length / 2);
    for (let index = 0; index < rows; index += 1) {
      const left = this.helpShortcut(shortcuts[index], columnWidth);
      const right = this.helpShortcut(shortcuts[index + rows], columnWidth);
      this.renderLine(index + 1, `${left}${right}`);
    }

    this.renderLine(this.height - 3, `${BOLD}${TAB_FOREGROUND} Author:${RESET}`);
    this.renderLine(
      this.height - 2,
      " Dominic Jomaa - https://github.com/paperschool/concurrently-paginated",
    );
    this.renderBar(
      this.height - 1,
      `${DIM} Press any key to close${RESET}`,
      STATUS_BACKGROUND,
    );
  }

  helpShortcut(shortcut, width) {
    if (!shortcut) {
      return " ".repeat(width);
    }

    const [key, action] = shortcut;
    const keyWidth = Math.min(22, Math.max(14, Math.floor(width * 0.42)));
    const keyText = ` ${key}`;
    const actionStart = Math.max(keyWidth, keyText.length + 1);
    const actionText = action.slice(0, Math.max(width - actionStart, 0));
    const gap = " ".repeat(actionStart - keyText.length);
    const padding = " ".repeat(Math.max(width - actionStart - actionText.length, 0));

    return `${BOLD}${TAB_FOREGROUND}${keyText}${RESET}${gap}${actionText}${padding}`;
  }

  renderStatusBar() {
    this.renderBar(this.height - 1, this.statusBarText(), STATUS_BACKGROUND);
  }

  statusBarText() {
    const version = `v${packageVersion}`;
    const available = Math.max(this.width - visibleLength(version) - 1, 10);
    const tabs = this.taskSummary(available);
    const gap = Math.max(this.width - visibleLength(tabs) - visibleLength(version), 1);

    return `${tabs}${" ".repeat(gap)}${DIM}${version}${RESET}`;
  }

  renderBar(row, text, background) {
    const fitted = visibleLength(text) > this.width ? wrapAnsi(text, this.width)[0] : text;
    const padding = " ".repeat(Math.max(this.width - visibleLength(fitted), 0));
    this.renderLine(row, `${background}${fitted}${padding}${RESET}`);
  }

  renderLine(row, text) {
    const fitted = visibleLength(text) > this.width ? wrapAnsi(text, this.width)[0] : text;
    const padding = " ".repeat(Math.max(this.width - visibleLength(fitted), 0));

    readline.cursorTo(this.output, 0, row);
    readline.clearLine(this.output, 0);
    this.output.write(`${fitted}${padding}`);
  }

  taskSummary(available = this.width - 1) {
    available = Math.max(available, 10);
    const tabWidth = (index) => visibleLength(this.taskTab(index, index === this.selectedIndex));
    const visibleIndexes = [this.selectedIndex];
    let used = tabWidth(this.selectedIndex);
    const separatorWidth = 5;

    const addTab = (index, extraWidth = 0) => {
      const width = separatorWidth + tabWidth(index) + extraWidth;

      if (used + width > available) {
        return false;
      }

      visibleIndexes.push(index);
      used += width;
      return true;
    };

    const immediate = [this.selectedIndex - 1, this.selectedIndex + 1].filter(
      (index) => index >= 0 && index < this.tabCount,
    );
    immediate.forEach((index) => addTab(index));

    const candidates = [];
    for (let distance = 2; distance < this.tabCount; distance += 1) {
      const left = this.selectedIndex - distance;
      const right = this.selectedIndex + distance;

      if (left >= 0) {
        candidates.push(left);
      }
      if (right < this.tabCount) {
        candidates.push(right);
      }
    }

    const blockedSides = new Set();
    candidates.forEach((index) => {
      const side = index < this.selectedIndex ? "left" : "right";

      if (blockedSides.has(side)) {
        return;
      }

      const hiddenOnSide = side === "left" ? index > 0 : index < this.tabCount - 1;
      const markerWidth = hiddenOnSide ? 5 : 0;

      if (!addTab(index, markerWidth)) {
        blockedSides.add(side);
      }
    });

    visibleIndexes.sort((left, right) => left - right);
    const visible = visibleIndexes.map((index) => this.taskTab(index, index === this.selectedIndex));
    const leftHidden = visibleIndexes[0] > 0;
    const rightHidden = visibleIndexes.at(-1) < this.tabCount - 1;
    const muted = (text) => `${DIM}${text}${RESET}${STATUS_BACKGROUND}`;
    const tabs = [
      ...(leftHidden ? [muted("...")] : []),
      ...visible,
      ...(rightHidden ? [muted("...")] : []),
    ];

    return `${tabs.join("  ")} `;
  }

  taskTab(index, selected) {
    const title = index === this.states.length ? "ALL" : this.states[index].name;
    const flashing = index < this.states.length && this.states[index].flashUntil > Date.now();

    if (selected) {
      return `${SELECTED_TAB_BACKGROUND}${SELECTED_TAB_FOREGROUND} ${title} ${RESET}${STATUS_BACKGROUND}`;
    }

    if (flashing) {
      return `${FLASH_TAB_FOREGROUND} ${title} ${RESET}${STATUS_BACKGROUND}`;
    }

    return `${TAB_FOREGROUND} ${title} ${RESET}${STATUS_BACKGROUND}`;
  }

  visualLines() {
    return this.currentLogs.flatMap((entry) =>
      wrapAnsi(this.formatLog({ ...entry, line: this.highlight(entry.line) }), this.width),
    );
  }

  highlight(line) {
    if (!this.searchQuery) {
      return line;
    }

    const escaped = this.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return line.replace(new RegExp(escaped, "gi"), (match) => `${REVERSE}${match}${RESET}`);
  }

  formatLog(entry) {
    if (this.allState === this.selectedState) {
      const state = this.states[entry.index];
      return `${taskColour(entry.index, `${state.name.padEnd(15)} `)}${entry.line}`;
    }

    return entry.line;
  }

  get currentLogs() {
    return this.selectedState === this.allState
      ? this.allState.buffer
      : this.selectedState.buffer.map((line) => ({ index: this.selectedIndex, line }));
  }

  get tabCount() {
    return this.states.length + 1;
  }

  get selectedState() {
    return this.selectedIndex === this.states.length
      ? this.allState
      : this.states[this.selectedIndex];
  }

  get width() {
    return this.output.columns || 80;
  }

  get height() {
    return this.output.rows || 30;
  }

  get visibleLineCount() {
    return Math.max(this.height - 3, 1);
  }
}

module.exports = { PaginatedRenderer };