const RESET = "\u001b[0m";
const BOLD = "\u001b[1m";
const DIM = "\u001b[2m";
const REVERSE = "\u001b[7m";
const TITLE_BACKGROUND = "\u001b[48;5;236m";
const STATUS_BACKGROUND = "\u001b[48;5;240m";
const SELECTED_TAB_BACKGROUND = "\u001b[48;5;153m";
const SELECTED_TAB_FOREGROUND = "\u001b[38;5;23m";
const TAB_FOREGROUND = "\u001b[38;5;250m";
const ENTER_ALTERNATE_SCREEN = "\u001b[?1049h\u001b[?25l";
const LEAVE_ALTERNATE_SCREEN = "\u001b[?25h\u001b[?1049l";
const SGR_PATTERN = "\\u001b\\[[\\d;]+m";
const TASK_COLOURS = [
  "\u001b[38;5;39m",
  "\u001b[38;5;220m",
  "\u001b[38;5;82m",
  "\u001b[38;5;213m",
  "\u001b[38;5;75m",
  "\u001b[38;5;208m",
  "\u001b[38;5;171m",
  "\u001b[38;5;51m",
  "\u001b[38;5;203m",
];

function stripAnsi(text) {
  return text.replace(new RegExp(SGR_PATTERN, "g"), "");
}

function stripTerminalControls(text) {
  return text
    .replace(
      /\u001b\[([0-?]*)([ -/]*)([@-~])/g,
      (sequence, params, intermediates, final) =>
        final === "m" ? sequence : "",
    )
    .replace(/\^\[\[([0-?]*)([ -/]*)([@-~])/g, "");
}

function visibleLength(text) {
  return Array.from(stripAnsi(text)).length;
}

function wrapAnsi(text, width) {
  if (width <= 0) {
    return [""];
  }

  const tokens = text.split(new RegExp(`(${SGR_PATTERN})`, "g"));
  const lines = [];
  let activeStyles = "";
  let currentLine = "";
  let currentWidth = 0;

  const pushLine = () => {
    lines.push(`${currentLine}${RESET}`);
    currentLine = activeStyles;
    currentWidth = 0;
  };

  for (const token of tokens) {
    if (!token) {
      continue;
    }

    if (new RegExp(`^${SGR_PATTERN}$`).test(token)) {
      currentLine += token;
      activeStyles = token === RESET ? "" : `${activeStyles}${token}`;
      continue;
    }

    for (const character of Array.from(token)) {
      if (currentWidth >= width) {
        pushLine();
      }

      currentLine += character;
      currentWidth += 1;
    }
  }

  if (currentWidth > 0 || lines.length === 0) {
    lines.push(`${currentLine}${RESET}`);
  }

  return lines;
}

function taskColour(index, text, suffix = "") {
  return `${TASK_COLOURS[index % TASK_COLOURS.length]}${text}${RESET}${suffix}`;
}

module.exports = {
  BOLD,
  DIM,
  ENTER_ALTERNATE_SCREEN,
  LEAVE_ALTERNATE_SCREEN,
  RESET,
  REVERSE,
  SELECTED_TAB_BACKGROUND,
  SELECTED_TAB_FOREGROUND,
  TAB_FOREGROUND,
  STATUS_BACKGROUND,
  TITLE_BACKGROUND,
  stripAnsi,
  stripTerminalControls,
  taskColour,
  visibleLength,
  wrapAnsi,
};