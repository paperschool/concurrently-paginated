# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

No unreleased changes.

## [0.5.1] - 2026-09-15

### Added

- Show the current scroll position in the title bar while browsing history.
- Return to live output with Space outside search mode.
- Start live search with `s` as an alternative to `/`.

### Changed

- Accelerate held Up and Down scrolling and coalesce interactive redraws.
- Refresh the keyboard help with a complete two-column shortcut reference and author link.
- Widen the aligned command-label column in the `ALL` view to fifteen characters.

## [0.5.0] - 2026-09-15

### Added

- Show live search match counts and support cycling matches with the Up and Down arrow keys.
- Flash inactive tabs with grey text when new output arrives.
- Support Ctrl+Q as an additional quit shortcut.
- Expand the example workspace with database and auth command streams.

### Changed

- Align command labels to a ten-character column in the `ALL` view.
- Keep manually scrolled command and `ALL` views anchored while new output arrives.
- Exclude `ALL` source labels from search matching and highlighting.

### Fixed

- Restore the terminal and stop all child processes after a single quit request.

## [0.4.0] - 2026-09-14

### Added

- Live search highlighting while typing.
- A formatted keyboard-shortcuts overlay opened with `?`.

### Changed

- Show the active search input in an orange full-width title bar.
- Use compact, dot-free tab spacing and full-width title/status bars.

## [0.3.1] - 2026-09-14

### Fixed

- Restore the terminal immediately when q or Ctrl+C is pressed, without waiting for runner promise settlement.

## [0.3.0] - 2026-09-14

### Added

- Documented the utility's capabilities and optional jq JSON formatting in the README.
- Added focused coverage for quit keys and tab overflow behavior.

### Changed

- Keep the selected tab and immediate neighboring tabs visible before distant tabs when the status bar is constrained.
- Make q and Ctrl+C quit handling resilient across the interactive lifecycle.

## [0.2.3] - 2026-09-14

### Fixed

- Use stable GitHub-hosted screenshot URLs so README images render on npm.
- Add repository and homepage metadata to the published package.

## [0.2.2] - 2026-09-14

### Changed

- Moved the funding documentation into `.github/FUNDING.md`.
- Refined the README, product documentation, and screenshot example formatting.

### Removed

- Removed the temporary status-bar palette preview script.

## [0.2.1] - 2026-09-14

### Added

- Added `npm run example` and a checked-in multi-command workspace simulation for screenshots and manual UI testing.
- Added a workspace `version-and-commit` prompt for consistent release preparation.
- Added README screenshots, funding information, and a macOS support disclaimer.

### Changed

- Applied a monochrome graphite treatment to the title and tab bars.
- Added a soft light-blue selected-tab highlight with grey tab labels.
- Simplified the title bar to show only the selected command and lifecycle status.
- Keep the interactive view open after all commands exit so their histories remain browsable.

### Fixed

- Decode multiple terminal escape sequences received in one input chunk so navigation keys are not printed as raw `^[[` text after terminal focus changes.
- Prevent terminal input from being forwarded to child processes and remove leaked cursor sequences from buffered history.

## [0.2.0] - 2026-09-14

### Added

- Search mode for the selected command history, with match highlighting and `n`/`N` navigation.
- An `ALL` tab showing bounded, chronological output from every command.
- Status indicators and stronger selected-tab treatment in the tab bar.
- Renderer tests covering combined history and search navigation.

### Changed

- Updated interactive controls and CLI help to include search and the `ALL` view.
- Established a release changelog and bumped the package from `0.1.0` to `0.2.0`.
