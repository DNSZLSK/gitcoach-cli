# Changelog

All notable changes to GitCoach are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.8] - 2026-09-16

Not yet published to npm.

### Added

- **Tags and releases.** A dedicated menu to list, create, push and delete
  tags, annotated or lightweight. Deleting removes the tag locally first and
  offers the remote deletion only when it is actually published there.
- **Amend and revert.** Amending is offered right after a commit, where a
  beginner looks for it, and again in Undo. It warns when the commit is already
  pushed, since that rewrites shared history. Revert shows the message git will
  generate before confirming, rather than leaving it to be discovered in the log.
- **A way out of interrupted operations.** A rebase, cherry-pick, merge or
  bisect that stopped part-way is detected on launch and offers continue, skip,
  cancel, or entry into the guided conflict resolver. The tool previously
  detected these states and warned about them without being able to resolve them.
- **Rebase and squash** in the Branch menu. Rebase refuses on a dirty tree and
  names how many of the commits being replayed are already published. Squash
  lists the commits that will disappear before doing it.
- **History inspection.** The patch a commit introduced, blame on any tracked
  file, and a comparison between two branches. Output is capped at 200 lines
  with the cap announced, so a large patch cannot bury the prompt.
- **Advanced menu.** Submodules (status, init, update, add), worktrees (list,
  add, remove) and commit signing (key, on, off), grouped under one entry rather
  than three so the main menu stays readable.
- **.gitignore management**, as its own main-menu entry next to Add, because
  the moment you want to ignore a file is the moment you see it listed as
  untracked. Ignore files by picking them from that list, add or remove a
  pattern by hand, write a starter template for Node, Python, Java or a generic
  project, and ask `git check-ignore` whether a path is covered. It also says
  the thing git never does: an ignore rule has no effect on a file already
  tracked, so `.env` added to .gitignore after being committed keeps being
  committed. GitCoach notices and offers the `git rm --cached` that makes it
  real, keeping the file on disk.
- **Cherry-pick**, in the Branch menu. The tool could already rescue one that
  had stopped part-way; there was no way to start one. It refuses on a dirty
  tree, offers only commits the current branch does not already have, and
  reports a conflict as the interrupted state the in-progress flow resolves
  rather than as a failure.
- **Deleting untracked files**, in Undo, always behind a preview. Untracked
  files were never committed, so unlike a reset there is no reflog to recover
  from — nothing is deleted before the exact list has been shown and picked
  from, every box starts unchecked, and the confirmation says it cannot be
  undone. Deliberately without `-x`: files covered by .gitignore, where
  node_modules and .env live, are never in the list.
- **Git LFS**, in the Advanced menu: set it up for the repository, send a
  pattern to it, stop sending one, list what is stored. git-lfs is a separate
  program, so a missing one is reported with how to install it rather than as a
  git error the user did not cause.

### Fixed

- **The detached-HEAD menu no longer appears mid-rebase.** git detaches HEAD for
  the duration of a rebase, so the recovery menu used to open during one and
  invite the user further into trouble. An interrupted operation is now checked
  first.
- **`continue` no longer reports success when git refused.** simple-git resolves
  rather than rejects when `rebase --continue` fails, putting git's refusal in
  the output, while `cherry-pick --continue` does reject. The same failure
  behaved differently depending on the command. Both are normalised, and the
  outcome is read from the repository state rather than from the absence of an
  exception.
- **The main menu printed untranslated keys.** Labels are chosen per experience
  level, so `menu.tags` is looked up as `menu.tagsBeginner`. Tags and Advanced
  were added without those variants, and i18next returned the key: the menu had
  been showing `[V] menu.tagsBeginner` and `[X] menu.advancedExpert` to the
  user, in all three languages. The key-parity test could not catch it, since
  the key was missing from en, fr and es alike.
- **`git check-ignore` was read wrong, so every path looked ignored.** The check
  assumed a non-zero exit would surface as a thrown error; simple-git resolves
  it quietly, so the branch that answered "not ignored" never ran.
- **Rebase counted commits belonging to the other branch.** simple-git defaults
  `log({from, to})` to the symmetric difference, not `from..to`, so the rebase
  confirmation offered to replay commits belonging to the branch being rebased
  *onto*. Present since rebase was added.
- **The Java .gitignore template did not cover `.env`**, alone among the four.
- **Only seven menu entries were visible at a time.** inquirer's default page
  size hid more than half of a seventeen-entry main menu behind a scroll with
  no indication it was there. Lists are now sized to the terminal. It mattered
  most on file checkboxes, where an entry below the fold is one the user did
  not mean to leave unselected.
- **The banner reappeared after every action**, because the main menu is
  re-rendered on each pass of the loop, pushing the result of what you just did
  off the screen. Shown once per session now.
- **Table headers were hard-coded in English** — Branch, Last Commit, Hash,
  Message, Date, File — and stayed English in a French or Spanish session.
- **Missing elisions in the French locale**: "na aucun" for "n'a aucun", "Cest"
  for "C'est", "l interieur" for "l'intérieur", across twenty-seven strings.

### Changed

- Startup is roughly 165ms faster. The twelve secondary menus load on demand
  instead of on every launch, and the two git probes the main menu needs now run
  concurrently.
- **The test suite moved from Jest to Vitest**, which runs the source as ESM.
  The five CommonJS stubs that stood in for chalk, ora, boxen, conf and
  @inquirer/prompts are gone, along with the moduleNameMapper that pointed at
  them; those packages load for real. One stub remains, unrelated to ESM: conf,
  because importing the config module builds its store and would otherwise
  write to the developer's own config directory.
- **The coverage figure is honest now, and lower for it.** An earlier entry in
  this file claimed 83.25%; that number described the fourteen files Jest could
  load, not the fifty-seven the project ships. Stubbing made all of them
  loadable and it read 45%. Vitest took it to 38%, because ts-jest compiled
  `import` to `require()` and istanbul counted those calls as statements that
  ran — so merely loading a menu scored its import block. Real work then took it
  to **72%**: 1036 tests across 41 suites, with branch, commit, undo, push,
  pull, stash, config, history, setup and gitignore driven through their real
  modules.
- **317 tests that executed no production line were removed or rewritten.**
  Found by running every test file alone under coverage rather than by reading
  them. Twelve suites asserted on mocks they had just called, on arrays of
  strings, or on the text of source files; ten were deleted once their behaviour
  was covered for real, and the rest rewritten. Every menu suite is now checked
  by mutation — the guard is removed on purpose and the suite has to fail.

## [1.1.7] - 2026-09-15

### Fixed

- **AI commit messages no longer leak model chatter.** The commit-message parser
  had a final fallback that returned the first "clean" line of the model's
  output with no validation, so a reply such as `Sure, here is your commit
  message:` could be proposed verbatim as the commit subject. Extraction now
  lives in `extractCommitMessage` (`src/utils/validators.ts`) and rejects
  conversational preambles (EN/FR/ES), meta-commentary, questions, lines ending
  in a colon, and markdown scaffolding. When nothing qualifies, GitCoach falls
  back to manual entry instead of proposing noise.
- The Copilot and Ollama providers now share that single extraction path. Ollama
  previously took the model's first non-empty line unconditionally.
- **Answers mentioning "token", "model" or "session" are no longer swallowed.**
  The output filters matched those words anywhere in a line, so a legitimate
  answer about a personal access token, or a commit touching a model file,
  was discarded as CLI telemetry. Patterns are now anchored to actual telemetry
  lines and shared via `TELEMETRY_LINE_PATTERNS`.

### Changed

- **Licence changed from MIT to Apache 2.0.** The repository declared MIT in
  `package.json` and the README but shipped no LICENSE file at all, so the one
  obligation MIT imposes, preserving the copyright notice, had no notice to
  preserve. Apache 2.0 keeps the same permissive terms and adds an express
  patent grant, an obligation to state modifications, and a trademark clause
  covering the GitCoach name. Versions 1.0.0 through 1.1.4, already published
  to npm, remain available under MIT; a licence change is not retroactive.
- `author` corrected to DNSZLSK in `package.json`.
- README restructured: logo header, `Quick Start` moved above the rationale,
  installation moved below the feature tour, the orphaned "Branch management"
  and "Multilingual support" sections nested under `Features`, warning and
  prerequisite lists turned into tables, and em dashes removed throughout.

### Added

- `LICENSE` (Apache 2.0, Copyright 2026 DNSZLSK) and `NOTICE`, both shipped
  with the npm package.
- 10 unit tests covering commit-message extraction (567 tests total).
- This changelog.
- Project logo (`docs/assets/logo.png`), shown at the top of the README.

### Removed

- `docs/README.md`, a stale duplicate of the root README that had been
  diverging since commit 433feea.

## [1.1.6] - 2026-09-15

Tagged but never published to npm; its contents ship in 1.1.7.

## [1.1.5] - 2026-05-30

Tagged but never published to npm; its contents ship with the next release.

### Security

- Replaced `exec` and a hand-rolled shell escaper with `cross-spawn`'s
  `execFile` (argument arrays, `shell: false`), removing the Windows `cmd.exe`
  injection surface. All AI calls go through a provider facade.

### Added

- `AIProvider` interface and `aiService` facade: GitHub Copilot CLI (default)
  and a local, secret-free Ollama provider, switchable in Settings.
- Prompt for git identity before the first commit.
- Warning before staging secrets or very large files.
- Reflog-based recovery menu for lost commits and branches.
- Clean exit on non-TTY; `NO_COLOR` is honored.

### Fixed

- Inverted staged-file filter in `getStatus`.
- Merge/rebase/cherry-pick/bisect detection now resolves the real `.git`
  directory via `rev-parse`, so it works from a subdirectory.
- `getLog` tolerates empty repositories; `fetch`, `stashApply` and `stashDrop`
  invalidate the status cache.
- `validatePush` blocks on detached HEAD; remote-URL validation unified.
- Banner uses `APP_VERSION`.

## [1.1.4] - 2026-03-10

### Fixed

- Audit pass: 10 correctness fixes, 555 tests, 0 vulnerabilities.

## [1.1.3] - 2026-02-06

### Changed

- README rewritten with full feature list and setup guide.
- Author section no longer carries a personal name.

## [1.1.2] - 2026-02-05

### Fixed

- Updated deprecated `gh copilot` references to the current `copilot` CLI.

## [1.1.1] - 2026-02-05

### Added

- Explanations surfaced throughout the menus.

### Fixed

- Committing with a merge conflict now redirects to the conflict-resolution menu.

## [1.1.0] - 2026-02-05

### Added

- Copilot-powered Git error explanations.
- AI-assisted conflict resolution.
- Staged-diff summaries.

## [1.0.15] - 2026-02-05

### Fixed

- Pull: rebase option, abort error handling, commit redirect.

## [1.0.14] - 2026-02-05

### Added

- Guided conflict resolution.

### Fixed

- Conflict resolution end-to-end, i18n coverage, BOM/CRLF handling, commit fixes.

## [1.0.13] - 2026-02-05

### Fixed

- Audit pass: error mapper, pull flow, state detection, i18n.

## [1.0.12] - 2026-01-28

### Fixed

- i18n audit: every hardcoded string is now translated.

## [1.0.11] - 2026-01-28

### Added

- Remote menu in the main menu for `git remote` management.

## [1.0.10] - 2026-01-25

### Fixed

- `--no-edit` on merge, so Vim no longer opens.

## [1.0.9] - 2026-01-24

### Changed

- Slogan changed from "AI-Powered" to "Interactive Git Assistant".

## [1.0.8] - 2026-01-24

### Changed

- Help menu refreshed.

## [1.0.7] - 2026-01-24

Tagged only; not published to npm.

### Added

- Interactive add-menu with multilingual i18n support.
- 202 UX tests, including end-to-end user journeys with mocked Inquirer.

## [1.0.6] - 2026-01-24

### Fixed

- License section in the README.

## [1.0.5] - 2026-01-24

### Fixed

- README synced with the actual feature set; dynamic version in the help menu.

## [1.0.4] - 2026-01-24

### Fixed

- README moved to the repository root; `package.json` metadata corrected.

## [1.0.3] - 2026-01-24

### Added

- Dynamic version display.
- Localized yes/no prompts.
- Detached HEAD handling.

### Changed

- Merged menu structure.

## [1.0.2] - 2026-01-24

### Added

- Recovery flow (merged via PR #1).

## [1.0.1] - 2026-01-24

### Added

- Improved Git question support in the help menu.

### Changed

- Documentation and configuration restructured.

## [1.0.0] - 2026-01-23

First release, published to npm as `gitcoach-cli`.

### Added

- Interactive menu-driven Git CLI with three experience levels
  (beginner, intermediate, expert).
- Deterministic error prevention: uncommitted-changes warnings, force-push
  protection, wrong-branch alerts, detached HEAD detection.
- GitHub Copilot CLI integration for commit-message generation, context
  analysis and beginner-facing explanations, with a manual fallback when the
  CLI is unavailable.
- Multilingual interface (EN/FR/ES) via i18next.
- Colored and monochrome themes.
- `gitcoach quick` for fast commit and push.
- Local analytics and persistent user configuration.

[1.1.8]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.1.7...v1.1.8
[1.1.7]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.1.6...v1.1.7
[1.1.6]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.1.5...v1.1.6
[1.1.5]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.1.4...v1.1.5
[1.1.4]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.0.15...v1.1.0
[1.0.15]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.0.14...v1.0.15
[1.0.14]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.0.13...v1.0.14
[1.0.13]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.0.12...v1.0.13
[1.0.12]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.0.11...v1.0.12
[1.0.11]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.0.10...v1.0.11
[1.0.10]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.0.9...v1.0.10
[1.0.9]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.0.8...v1.0.9
[1.0.8]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/DNSZLSK/gitcoach-cli/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/DNSZLSK/gitcoach-cli/releases/tag/v1.0.1
[1.0.0]: https://www.npmjs.com/package/gitcoach-cli/v/1.0.0
