# Change Log

All notable changes to the "markdown-diff-for-ai" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.5] - 2026-09-01

### Fixed
- Fixed an issue where images were rendered as plain text when their URL or alt text was modified. Changed to use block-level replacement for modified images to preserve markdown syntax.
- Appended a hash cache-buster to WebView URIs to force VS Code to render the correct image binary data instead of stale caches when comparing local images or Git history, especially when images were renamed or swapped.
- Implemented asynchronous fetching of binary image data from Git refs.
- Normalized CRLF to LF line endings for SVG images before computing hashes to prevent false positive diffs on Windows.

## [1.0.4] - 2026-09-01

### Added
- Added deep structural AST diffing for tables and code blocks.
  - Tables now preserve their layout and borders, precisely highlighting modified cells.
  - Code blocks now preserve syntax highlighting, precisely highlighting modified lines.

## [1.0.3] - 2026-09-01

### Fixed
- Fixed an issue where the output order of diff blocks (added, removed, modified) was incorrect when a block was heavily modified or split. The diff engine now properly preserves the relative sequential order of the original document.

## [1.0.2] - 2026-08-22

### Added
- Added full UI localization (package.nls) and translated README documentation for 6 new languages: Chinese (Simplified), Korean, Spanish, German, French, and Portuguese (Brazil). (Total 8 languages supported).
- Added cross-navigation language links to the top of all README files.

### Fixed
- Minor bug fixes to improve diff accuracy.

## [1.0.0] - 2026-08-20

### Added
- **Initial Release:** Markdown Diff for AI v1.0.0 is officially released! 🎉
- **Fine-Grained Markdown AST Diffing Engine:** Accurately compares two Markdown files by parsing them into AST (Abstract Syntax Tree) and identifies structural modifications (paragraphs, code blocks, lists) rather than just line-by-line diffs.
- **Webview UI (Rendered Comparison):** Displays differences in a beautifully rendered, side-by-side HTML preview, making it effortless to review AI-generated revisions or large structural shifts.
- **Git Integration:** 
  - Compare current file with HEAD or previous changes.
  - Interactive `QuickPick` menus to select specific commits or local branches to compare against.
  - Automatically handles line-ending normalization (CRLF/LF) for Git operations.
- **Settings Customization:** Configurable `defaultSensitivity` (to control how strictly blocks match) and `commitHistoryLimit` (to control how many commits are loaded in the selection UI).
