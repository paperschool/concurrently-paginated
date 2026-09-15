const assert = require("node:assert/strict");
const test = require("node:test");
const { PassThrough } = require("node:stream");
const packageVersion = require("../package.json").version;
const { stripAnsi } = require("../src/ansi");
const { PaginatedRenderer } = require("../src/renderer");

function createRenderer(commands, columns = 80) {
    const output = new PassThrough();
    output.columns = columns;
    output.rows = 10;

    return new PaginatedRenderer(
        commands || [{ name: "ONE" }, { name: "TWO" }],
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
    assert.equal(stripAnsi(renderer.formatLog(renderer.currentLogs[0])).indexOf("second"), 16);
});

test("pads ALL source labels to a fifteen-character column", () => {
    const renderer = createRenderer([
        { name: "API" },
        { name: "DATABASE" },
    ]);
    renderer.append(0, "request");
    renderer.append(1, "query");
    renderer.select(2);

    assert.equal(stripAnsi(renderer.formatLog(renderer.currentLogs[0])).indexOf("request"), 16);
    assert.equal(stripAnsi(renderer.formatLog(renderer.currentLogs[1])).indexOf("query"), 16);
});

test("searches and highlights ALL log content without source labels", () => {
    const renderer = createRenderer([{ name: "API" }, { name: "WEB" }]);
    renderer.append(0, "API request started");
    renderer.select(2);
    renderer.finishSearch("API");

    assert.equal(renderer.searchMatches.length, 1);
    const rendered = renderer.visualLines()[0];
    assert.equal(stripAnsi(rendered), "API             API request started");
    assert.ok(rendered.indexOf("\u001b[7m") > rendered.indexOf("API             "));
});

test("keeps the ALL viewport stable while new logs arrive below it", () => {
    const renderer = createRenderer();
    for (let index = 0; index < 12; index += 1) {
        renderer.append(index % 2, `line ${index}`);
    }
    renderer.select(2);
    renderer.scrollBy(1);

    const scrollBeforeAppend = renderer.allState.scrollOffset;
    renderer.append(1, "new below");

    assert.equal(renderer.allState.scrollOffset, scrollBeforeAppend + 1);
});

test("accelerates repeated arrow scrolling and resets after a pause", () => {
    const renderer = createRenderer();

    assert.deepEqual(
        Array.from({ length: 13 }, (_, index) => renderer.acceleratedScrollAmount(1, index * 20)),
        [1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 8],
    );
    assert.equal(renderer.acceleratedScrollAmount(1, 500), 1);
    assert.equal(renderer.acceleratedScrollAmount(-1, 520), -1);
});

test("returns to live output with Space outside search mode", () => {
    const renderer = createRenderer();
    renderer.selectedState.scrollOffset = 5;

    renderer.processInputKey(" ");

    assert.equal(renderer.selectedState.scrollOffset, 0);
});

test("keeps Space as search input while searching", () => {
    const renderer = createRenderer();
    renderer.beginSearch();

    renderer.processInputKey(" ");

    assert.equal(renderer.searchInput, " ");
});

test("starts search with s and accepts s in the search query", () => {
    const renderer = createRenderer();

    renderer.processInputKey("s");
    renderer.processInputKey("s");

    assert.equal(renderer.searchMode, true);
    assert.equal(renderer.searchInput, "s");
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

test("updates search matches while typing before Enter", () => {
    const renderer = createRenderer();

    renderer.append(0, "build started");
    renderer.append(0, "test finished");
    renderer.beginSearch();
    renderer.handleSearchInput("b");
    renderer.handleSearchInput("u");
    renderer.handleSearchInput("i");
    renderer.handleSearchInput("l");
    renderer.handleSearchInput("d");

    assert.equal(renderer.searchMode, true);
    assert.equal(renderer.searchQuery, "build");
    assert.equal(renderer.searchMatches.length, 1);
    assert.match(stripAnsi(renderer.titleBarText()), /match 1\/1/);
    assert.match(renderer.highlight("build started"), /\u001b\[7mbuild\u001b\[0m/);
});

test("moves between search matches with Up and Down", () => {
    const renderer = createRenderer();

    renderer.append(0, "build one");
    renderer.append(0, "build two");
    renderer.beginSearch();
    renderer.handleSearchInput("b");
    renderer.handleSearchInput("u");
    renderer.handleSearchInput("i");
    renderer.handleSearchInput("l");
    renderer.handleSearchInput("d");

    renderer.handleSearchInput("\u001b[B");
    assert.equal(renderer.searchMatchIndex, 1);
    assert.match(stripAnsi(renderer.titleBarText()), /match 2\/2/);

    renderer.handleSearchInput("\u001b[A");
    assert.equal(renderer.searchMatchIndex, 0);
});

test("renders clean title-only tabs with a solid selected state", () => {
    const renderer = createRenderer();
    const summary = renderer.taskSummary();

    assert.match(summary, /ONE/);
    assert.doesNotMatch(summary, /Tabs:|1:|\[ONE\]/);
    assert.doesNotMatch(summary, /·/);
    assert.match(summary, /\u001b\[48;5;153m\u001b\[38;5;23m ONE \u001b\[0m/);
    assert.doesNotMatch(summary, /\u001b\[38;5;220m|\u001b\[38;5;82m/);

    renderer.select(2);
    assert.match(renderer.taskSummary(), /\u001b\[48;5;153m\u001b\[38;5;23m ALL \u001b\[0m/);
});

test("decodes multiple terminal key sequences from one input chunk", () => {
    const renderer = createRenderer();

    renderer.handleInput(Buffer.from("\u001b[C\u001b[C\u001b[D"));

    assert.equal(renderer.selectedIndex, 1);
});

test("keeps the title bar to the command name and status", () => {
    const renderer = createRenderer();

    assert.equal(renderer.titleText(), " ONE - running ");
});

test("shows history position in the title bar while scrolled", () => {
    const renderer = createRenderer();
    for (let index = 0; index < 12; index += 1) {
        renderer.append(0, `line ${index}`);
    }
    renderer.scrollBy(2);

    assert.match(stripAnsi(renderer.titleBarText()), /history 2\/3 $/);
    renderer.scrollToLatest();
    assert.doesNotMatch(stripAnsi(renderer.titleBarText()), /history/);
});

test("does not retain terminal input sequences in exited command history", () => {
    const renderer = createRenderer();

    renderer.append(0, "ready\u001b[C^[[D");
    renderer.setStatus(0, "exit 0");

    assert.equal(renderer.states[0].buffer[0], "ready");
});

test("keeps immediate neighboring tabs visible before distant tabs", () => {
    const commands = Array.from({ length: 7 }, (_, index) => ({
        name: `TAB-${index + 1}`,
    }));
    const renderer = createRenderer(commands, 45);
    renderer.select(3);

    const summary = renderer.taskSummary();

    assert.match(summary, /TAB-3/);
    assert.match(summary, /TAB-4/);
    assert.match(summary, /TAB-5/);
    assert.doesNotMatch(summary, /TAB-1|TAB-2|TAB-6|TAB-7/);
});

test("handles q, Ctrl+Q, and Ctrl+C as quit requests", () => {
    const renderer = createRenderer();
    let quitRequests = 0;
    renderer.onQuit = () => {
        quitRequests += 1;
    };

    renderer.processInputKey("q");
    renderer.processInputKey("\u0011");
    renderer.processInputKey("\u0003");

    assert.equal(quitRequests, 3);
});

test("right-aligns the package version in the status bar", () => {
    const renderer = createRenderer();
    const status = renderer.statusBarText();

    assert.match(status, new RegExp(`v${packageVersion.replaceAll(".", "\\.")}`));
    assert.equal(renderer.output.columns - stripAnsi(status).length, 0);
});

test("fills the title bar to the terminal width", () => {
    const renderer = createRenderer();

    assert.equal(stripAnsi(renderer.titleBarText()).length, renderer.output.columns);
});

test("places search input in the right side of the title bar", () => {
    const renderer = createRenderer();
    renderer.beginSearch();
    renderer.handleSearchInput("a");

    assert.match(stripAnsi(renderer.titleBarText()), /^ search: a_/);
    assert.equal(stripAnsi(renderer.titleBarText()).length, renderer.output.columns);
});

test("restores the normal title after completing search or changing tabs", () => {
    const renderer = createRenderer();

    renderer.beginSearch();
    renderer.finishSearch("build");
    assert.equal(renderer.searchMode, false);
    assert.match(stripAnsi(renderer.titleBarText()), /ONE - running/);

    renderer.beginSearch();
    renderer.select(1);
    assert.equal(renderer.searchMode, false);
    assert.match(stripAnsi(renderer.titleBarText()), /TWO - running/);
});

test("shows shortcuts on ? and dismisses them with the next key", () => {
    const renderer = createRenderer();

    renderer.processInputKey("?");
    assert.equal(renderer.helpMode, true);
    assert.match(stripAnsi(renderer.titleBarText()), /ONE - running/);

    renderer.processInputKey("x");
    assert.equal(renderer.helpMode, false);
    assert.equal(renderer.selectedIndex, 0);
});

test("shows every keyboard shortcut in the help menu", () => {
    const renderer = createRenderer(undefined, 80);
    renderer.output.rows = 12;
    let rendered = "";
    renderer.output.on("data", (chunk) => {
        rendered += chunk.toString("utf8");
    });

    renderer.renderHelp();

    const help = stripAnsi(rendered);
    for (const shortcut of [
        "Tab or Right",
        "Shift+Tab or Left",
        "1-9",
        "Up or Down",
        "Page Up or Page Down",
        "Space or End",
        "/ or s",
        "n or N",
        "Enter or Esc",
        "?",
        "q or Ctrl+Q or Ctrl+C",
    ]) {
        assert.match(help, new RegExp(shortcut.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.match(help, /q or Ctrl\+Q or Ctrl\+C\s+Stop all commands/);
    assert.match(help, /Author:/);
    assert.match(
        help,
        /Dominic Jomaa - https:\/\/github\.com\/paperschool\/concurrently-paginated/,
    );
});

test("flashes an inactive tab using text colour only", () => {
    const renderer = createRenderer();
    renderer.started = true;
    renderer.append(1, "new output");

    assert.ok(renderer.states[1].flashUntil > Date.now());
    assert.match(renderer.taskTab(1, false), /\u001b\[38;5;255m TWO /);
    assert.doesNotMatch(renderer.taskTab(1, false), /\u001b\[48;5;244m/);
});

test("does not flash the selected tab for its own new logs", () => {
    const renderer = createRenderer();
    renderer.started = true;
    renderer.append(0, "selected output");

    assert.equal(renderer.states[0].flashUntil, 0);
});
