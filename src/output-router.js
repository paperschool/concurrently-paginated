class OutputRouter {
  constructor(onLine) {
    this.onLine = onLine;
    this.pending = new Map();
  }

  write(index, text) {
    const lines = `${this.pending.get(index) || ""}${text}`.split(/\r?\n/);
    this.pending.set(index, lines.pop() || "");
    lines.forEach((line) => this.onLine(index, line));
  }

  flush() {
    this.pending.forEach((line, index) => {
      if (line) {
        this.onLine(index, line);
      }
    });
    this.pending.clear();
  }
}

module.exports = { OutputRouter };