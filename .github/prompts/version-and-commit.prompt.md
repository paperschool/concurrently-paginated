---
name: version-and-commit
description: "Update the changelog, choose or apply a logical semantic version, validate the package, and create one concise Conventional Commit without a co-author trailer."
argument-hint: "Optional: specify patch, minor, major, an exact version, or a concise release summary"
---

# Version And Commit

Prepare and commit the current release changes in this repository.

## Workflow

1. Inspect `git status`, the current branch, the recent commits, `package.json`, `package-lock.json`, and `CHANGELOG.md` before editing.
2. Treat any user changes already present in the worktree as intentional. Do not reset, discard, or overwrite unrelated changes.
3. Review the diff and identify the user-facing or technical changes that belong in this release. If there are no meaningful changes to release, stop and explain why.
4. Choose the version bump using this policy unless the user supplied an explicit level or version:
   - `patch`: bug fixes, documentation, tests, examples, refactors, or internal improvements that do not add a public capability.
   - `minor`: backwards-compatible features or meaningful new user-facing behavior.
   - `major`: breaking API, CLI, behavior, or packaging changes.
5. If the user supplied `patch`, `minor`, `major`, or an exact semantic version, use that request instead of inferring the bump. Reject invalid or backward version changes.
6. Update the changelog before committing:
   - Move the relevant `Unreleased` entries into a new version heading dated today.
   - Keep an `Unreleased` section for future work.
   - Use the repository's existing Keep a Changelog style.
   - Mention the final version and the important behavior changes, not implementation trivia.
7. Update the package version consistently in `package.json` and `package-lock.json`. Prefer `npm version --no-git-tag-version <patch|minor|major>` for level bumps so npm updates both files without creating an automatic commit or tag. For an exact version, use the equivalent no-git-tag version update.
8. Run the repository validation commands from `package.json`, at minimum:
   - `npm test`
   - `npm run lint`
   - `npm pack --dry-run`
   - `git diff --check`
9. If validation fails, fix only release-related problems and rerun the failing check. Do not commit failing tests or lint errors.
10. Stage only the release-related files. Leave unrelated worktree changes unstaged and untouched.
11. Create exactly one concise Conventional Commit using a format such as:
    - `fix(tui): preserve history after process exit`
    - `feat(search): add history filtering`
    - `chore(release): prepare v0.3.0`
12. Do not add `Co-authored-by`, `Signed-off-by`, or any other author trailer. Do not use `--no-verify`.
13. Verify the final commit with `git show --stat --oneline HEAD`, `git show -s --format=%B HEAD`, and `git status --short --branch`.

## Completion Report

Report:

- The selected version and why it was selected
- The changelog section updated
- Validation commands and their results
- The commit hash and concise commit subject
- Any unrelated changes intentionally left unstaged

Do not push, publish to npm, create a tag, or create a branch unless the user explicitly asks for that separately.
