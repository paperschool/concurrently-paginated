# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

No unreleased changes.

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
