const readline = require("node:readline");
const {
  DIM,
  ENTER_ALTERNATE_SCREEN,
  LEAVE_ALTERNATE_SCREEN,
  REVERSE,
  RESET,
  SELECTED_TAB_BACKGROUND,
  SELECTED_TAB_FOREGROUND,
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
      status: "running",
    }));
    this.allState = {
      buffer: [],
      index: this.states.length,
      name: "ALL",
      running: true,
      scrollOffset: 0,
      status: "live",
    };
    this.selectedIndex = 0;
    this.searchMode = false;
    this.searchInput = "";
    this.searchQuery = "";
    this.searchMatches = [];
    this.searchMatchIndex = -1;
    this.pendingInput = "";
    this.inputSequenceTimer = null;
    this.renderQueued = false;
    this.started = false;
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
    this.output.write(LEAVE_ALTERNATE_SCREEN);
  }

  append(index, line) {
    const state = this.states[index];
    line = stripTerminalControls(line);
    state.buffer.push(line);
    this.allState.buffer.push({ index, line });

    if (state.scrollOffset > 0) {
      state.scrollOffset += wrapAnsi(line, this.width).length;
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
    if (this.searchMode) {
      this.handleSearchInput(key);
      return;
    }

    if (key === "\u0003" || key.toLowerCase() === "q") {
      if (this.onQuit) {
        this.onQuit();
      }
    } else if (key === "/") {
      this.beginSearch();
    } else if (key === "n") {
      this.nextSearchMatch(1);
    } else if (key === "N") {
      this.nextSearchMatch(-1);
    } else if (key === "\t" || key === "\u001b[C") {
      this.select(this.selectedIndex + 1);
    } else if (key === "\u001b[Z" || key === "\u001b[D") {
      this.select(this.selectedIndex - 1);
    } else if (key === "\u001b[A") {
      this.scrollBy(1);
    } else if (key === "\u001b[B") {
      this.scrollBy(-1);
    } else if (key === "\u001b[5~") {
      this.scrollBy(this.visibleLineCount);
    } else if (key === "\u001b[6~") {
      this.scrollBy(-this.visibleLineCount);
    } else if (key === "\u001b[F") {
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
    if (this.searchQuery) {
      this.searchMatches = this.findSearchMatches();
      this.searchMatchIndex = this.searchMatches.length > 0 ? 0 : -1;
    }
    this.render();
  }

  beginSearch() {
    this.searchMode = true;
    this.searchInput = "";
    this.render();
  }

  handleSearchInput(key) {
    if (key === "\u001b") {
      this.searchMode = false;
      this.render();
    } else if (key === "\r" || key === "\n") {
      this.finishSearch(this.searchInput);
    } else if (key === "\u007f" || key === "\b") {
      this.searchInput = this.searchInput.slice(0, -1);
      this.render();
    } else if (key.length === 1 && key >= " ") {
      this.searchInput += key;
      this.render();
    }
  }

  finishSearch(query) {
    this.searchMode = false;
    this.searchQuery = query;
    this.searchMatches = this.findSearchMatches();
    this.searchMatchIndex = this.searchMatches.length > 0 ? 0 : -1;
    this.focusSearchMatch();
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
    state.scrollOffset = Math.min(
      Math.max(state.scrollOffset + amount, 0),
      maxOffset,
    );
    this.render();
  }

  scrollToLatest() {
    this.selectedState.scrollOffset = 0;
    this.render();
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
    const state = this.selectedState;
    const lines = this.visualLines(state);
    const end = Math.max(lines.length - state.scrollOffset, 0);
    const start = Math.max(end - this.visibleLineCount, 0);

    readline.cursorTo(this.output, 0, 0);
    readline.clearScreenDown(this.output);
    const controls = this.searchMode
      ? `${DIM}Search: ${this.searchInput}_ | Enter find | Esc cancel${RESET}`
      : `${DIM}/ search | n/N next/previous | Tab/Left/Right switch | Up/Down scroll | PgUp/PgDn page | End live | q quit${RESET}`;
    this.renderLine(1, controls);
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
    const title = this.titleText();

    this.renderBar(0, `${TAB_FOREGROUND}${title}${RESET}`, STATUS_BACKGROUND);
  }

  titleText() {
    const state = this.selectedState;
    return ` ${state.name} - ${state.status} `;
  }

  renderStatusBar() {
    this.renderBar(this.height - 1, this.taskSummary(), STATUS_BACKGROUND);
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

  taskSummary() {
    const available = Math.max(this.width - 1, 10);
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

    return `${tabs.join(`${muted("  ·  ")}`)} `;
  }

  taskTab(index, selected) {
    const title = index === this.states.length ? "ALL" : this.states[index].name;

    if (selected) {
      return `${SELECTED_TAB_BACKGROUND}${SELECTED_TAB_FOREGROUND} ${title} ${RESET}${STATUS_BACKGROUND}`;
    }

    return `${TAB_FOREGROUND} ${title} ${RESET}${STATUS_BACKGROUND}`;
  }

  visualLines() {
    return this.currentLogs.flatMap((entry) =>
      wrapAnsi(this.highlight(this.formatLog(entry)), this.width),
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
      return `${taskColour(entry.index, `${state.name} `)}${entry.line}`;
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