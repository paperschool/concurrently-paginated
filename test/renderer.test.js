const assert = require("node:assert/strict");
const test = require("node:test");
const { PassThrough } = require("node:stream");
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
    assert.match(stripAnsi(renderer.formatLog(renderer.currentLogs[0])), /TWO second/);
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

test("renders clean title-only tabs with a solid selected state", () => {
    const renderer = createRenderer();
    const summary = renderer.taskSummary();

    assert.match(summary, /ONE/);
    assert.doesNotMatch(summary, /Tabs:|1:|\[ONE\]/);
    assert.match(summary, /\u001b\[2m  ·  \u001b\[0m/);
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

    test("handles q and Ctrl+C as quit requests", () => {
        const renderer = createRenderer();
        let quitRequests = 0;
        renderer.onQuit = () => {
            quitRequests += 1;
        };

        renderer.processInputKey("q");
        renderer.processInputKey("\u0003");

        assert.equal(quitRequests, 2);
    });