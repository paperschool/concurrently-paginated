#!/usr/bin/env node

const RESET = "\u001b[0m";
const DIM = "\u001b[38;5;245m";
const MID = "\u001b[38;5;250m";
const BRIGHT = "\u001b[38;5;255m";
const DARK = "\u001b[38;5;232m";
const CHARCOAL = "\u001b[48;5;236m";
const SLATE = "\u001b[48;5;238m";
const GRAPHITE = "\u001b[48;5;240m";
const BLUE_GREY = "\u001b[48;5;239m";
const SILVER = "\u001b[48;5;243m";
const SELECTED = "\u001b[48;5;250m";
const tabs = ["API", "WORKER", "WEB", "ALL"];

function resetLine(text) {
  return `${text}${RESET}\n`;
}

function tabsLine(separator, selected, textColour = MID, selectedBackground = SELECTED) {
  return tabs
    .map((tab) => {
      if (tab === selected) {
        return `${selectedBackground}${DARK} ${tab} ${RESET}`;
      }

      return `${textColour} ${tab} ${RESET}`;
    })
    .join(`${DIM}${separator}${RESET}`);
}

function printVariant(number, label, background, content) {
  process.stdout.write(`${DIM}${String(number).padStart(2, " ")}  ${label.padEnd(24)}${RESET}`);
  process.stdout.write(`${background}${content}${" ".repeat(12)}${RESET}\n`);
}

process.stdout.write("\n");
process.stdout.write(resetLine(`${BRIGHT}Status bar palette preview${RESET}`));
process.stdout.write(`${DIM}The selected tab is WORKER in rows 1-11 and ALL in row 12.${RESET}\n\n`);

printVariant(1, "dots / charcoal", CHARCOAL, tabsLine("  ·  ", "WORKER"));
printVariant(2, "dots / slate", SLATE, tabsLine("  ·  ", "WORKER"));
printVariant(3, "dots / graphite", GRAPHITE, tabsLine("  ·  ", "WORKER"));
printVariant(4, "dots / blue-grey", BLUE_GREY, tabsLine("  ·  ", "WORKER"));
printVariant(5, "bullets / charcoal", CHARCOAL, tabsLine("  •  ", "WORKER"));
printVariant(6, "sparse dots / charcoal", CHARCOAL, tabsLine("     ·     ", "WORKER"));
printVariant(7, "slashes / graphite", GRAPHITE, tabsLine("  /  ", "WORKER"));
printVariant(8, "plain spacing / charcoal", CHARCOAL, tabsLine("     ", "WORKER"));
printVariant(9, "bright text / charcoal", CHARCOAL, tabsLine("  ·  ", "WORKER", BRIGHT));
printVariant(10, "dim text / charcoal", CHARCOAL, tabsLine("  ·  ", "WORKER", DIM));
printVariant(11, "silver bar", SILVER, tabsLine("  ·  ", "WORKER"));
printVariant(12, "silver selected tab", CHARCOAL, tabsLine("  ·  ", "ALL", MID, SILVER));

process.stdout.write(`\n${DIM}ANSI colours may vary with your terminal theme.${RESET}\n\n`);
