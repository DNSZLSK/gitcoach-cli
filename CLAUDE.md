# CLAUDE.md - GitCoach Project

## Project Overview

**GitCoach** is an AI-powered Git coach CLI that prevents mistakes before they happen. Built for the GitHub Copilot CLI Challenge (deadline: February 15, 2026, 23:59 PST).

**Core Problem:** Beginners lose work from Git mistakes; developers waste time searching for solutions; commit messages are generic.

**Solution:** Interactive multilingual CLI with guided menus for beginners, quick shortcuts for experts, contextual analysis via Copilot CLI, real-time error prevention, and intelligent commit generation.

---

## Current State (2026-09-16)

Version 1.1.7 shipped. Ten commits sit on `master` unpushed. **Do not push without
being asked** — the remote is `github.com/DNSZLSK/gitcoach-cli` and npm publish
follows from it.

### Shipped since 1.1.7 (local only)

Tags and releases, commit amend and revert, a way out of interrupted operations
(`--continue` / `--skip` / `--abort` for merge, rebase, cherry-pick), rebase onto a
branch and squash, blame / commit patch / branch comparison, submodules,
worktrees, commit signing, and a ~165ms cut to startup.

### Not shipped — the four features that finish the tool

1. `.gitignore` management (the only current mention is inside `setup-menu.ts`)
2. Cherry-pick **as an action the user initiates** — today the tool can only
   rescue a cherry-pick that is already in progress
3. `git clean` for untracked files
4. Git LFS

### What a good test is here

Coverage is a smoke alarm, not a certificate. It says which lines were walked
through, never whether an assertion checked anything worth checking. This
project has the proof in its own history: 278 tests with non-zero coverage that
execute no production line at all.

The standard is simple — **a test earns its place by failing when the behaviour
changes.** The integration tests that run against real git have met it: they
caught the simple-git bug on `rebase --continue`, the `^{}` suffix from
`ls-remote`, the NUL byte Node rejects. A test that mocks a thing and then
asserts the mock was called has met nothing.

So read the percentages below as a map of untested territory, and never as a
target to hit.

### Test reality

1085 tests, 45 suites, all green on Vitest. Coverage stands at **57%**.

It has been restated downward twice and raised once, and only the last move
counted for anything: the two falls came from removing things that were never
evidence (files Jest could not load; `require()` calls istanbul scored as
executed statements), the rise came from writing tests that break when the
menus change.

The five most-used menus are covered, each verified by mutation rather than by
percentage — the guard was removed on purpose and the suite had to fail:

| Menu | Statements | Checked by breaking |
|------|-----------|---------------------|
| `branch-menu.ts` | 96% | dropped the current-branch filter, deleted without confirming, rebased a dirty tree |
| `undo-menu.ts` | 95% | single-confirmed the hard reset, pre-checked the restore boxes |
| `push-menu.ts` | 95% | single-confirmed the force push, forced the ordinary push |
| `pull-menu.ts` | 95% | pulled into a live merge, skipped the stash, dropped `--rebase` |
| `commit-menu.ts` | 93% | ignored an unresolved conflict, skipped the risky-file question |

Still at zero, and next in line: `add-menu`, `stash-menu`, `config-menu`,
`history-menu`, `main-menu`, `remote-menu`, `help-menu`,
`detached-head-menu`, and the `src/commands` entry points.

Roughly **278 tests still execute no production line at all**. They assert on
mocks, on arrays of strings, or on the text of source files —
`test/e2e/user-journeys.test.ts`, `test/integration/basic-workflow.test.ts`,
`test/config/user-config.test.ts` and the older `test/ui/*` suites are the
pattern.

The suites that do it right, and that new tests should copy:
`test/ui/tag-menu.test.ts`, `test/ui/in-progress-flow.test.ts`,
`test/ui/advanced-menu.test.ts` — they import the real menu, drive it through
mocked prompts, and assert on the git calls it made.

---

## Roadmap — in this order

**1. ~~Migrate Jest → Vitest~~ — done.** Config lives in `vitest.config.ts`;
`jest.config.js` and `test/stubs/` are gone, along with the `moduleNameMapper`.
chalk, ora, boxen and `@inquirer/prompts` load for real. Globals stay injected
(`globals: true`), so the migration touched mocking and nothing else.

One stub survives, aliased in the config and unrelated to ESM:
`test/mocks/conf.ts`. `src/config/user-config.ts` builds its store at module
scope, so importing it would write to the developer's own config directory.

**2. ~~Real tests for the five main menus~~ — done.** branch, commit, undo,
push and pull now import the real menu, drive it through mocked prompts and
assert on the git calls it made, on the `test/ui/tag-menu.test.ts` model. Each
suite was checked by breaking the menu on purpose; the table above records what
was broken. Suites reset mocks between tests rather than clearing them —
clearing leaves implementations behind and a queued rejection leaks into the
next test.

**3. The four missing features**: `.gitignore`, cherry-pick, `clean`, LFS.

**4. Clear out the 278 phantom tests**, either by rewriting them against the real
modules or by deleting them. A test that cannot fail is worse than no test: it
buys confidence it has not earned.

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Language | TypeScript (Node.js) |
| CLI Framework | Oclif |
| Prompts/Menus | Inquirer.js |
| Git Operations | simple-git |
| Display | Chalk, Boxen, cli-table3 |
| i18n | i18next |
| AI Integration | GitHub Copilot CLI |
| Config Storage | Conf |
| Analytics | Counters in the Conf store (no SQLite) |
| Testing | Vitest (migrating off Jest — see Roadmap) |

---

## Project Structure

```
gitcoach/
├── bin/
│   └── run.js                    # Entry point
├── src/
│   ├── commands/
│   │   ├── index.ts              # Main menu
│   │   ├── init.ts               # First-time setup
│   │   ├── config.ts             # Configuration menu
│   │   ├── quick.ts              # Expert mode (hotkey)
│   │   └── stats.ts              # Analytics dashboard
│   ├── services/
│   │   ├── git-service.ts        # Git operations wrapper
│   │   ├── copilot-service.ts    # Copilot CLI integration
│   │   ├── analysis-service.ts   # Context analysis
│   │   └── prevention-service.ts # Error detection
│   ├── ui/
│   │   ├── menus/
│   │   │   ├── main-menu.ts
│   │   │   ├── add-menu.ts
│   │   │   ├── commit-menu.ts
│   │   │   ├── branch-menu.ts
│   │   │   └── config-menu.ts
│   │   ├── themes/
│   │   │   ├── colored.ts
│   │   │   └── monochrome.ts
│   │   └── components/
│   │       ├── box.ts
│   │       ├── table.ts
│   │       └── prompt.ts
│   ├── i18n/
│   │   ├── locales/
│   │   │   ├── en.json
│   │   │   ├── fr.json
│   │   │   └── es.json
│   │   └── index.ts
│   ├── config/
│   │   ├── user-config.ts        # User preferences
│   │   └── defaults.ts           # Default settings
│   ├── analytics/
│   │   ├── tracker.ts            # Usage tracking
│   │   └── stats-calculator.ts   # Metrics calculation
│   └── utils/
│       ├── logger.ts
│       ├── validators.ts
│       └── helpers.ts
├── test/
│   ├── unit/
│   └── integration/
├── docs/
│   ├── README.md
│   ├── INSTALLATION.md
│   ├── USAGE.md
│   └── DEMO.md
├── package.json
├── tsconfig.json
└── .eslintrc.js
```

---

## Development Commands

```bash
# Install dependencies
npm install

# Development mode with watch
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Link CLI globally for testing
npm link

# Run CLI locally
./bin/run.js
```

---

## Key Features to Implement

### MVP (Must Have)

1. **Interactive Main Menu** - Spring Boot CLI inspired design
2. **Basic Git Operations** - status, add, commit, push with explanations
3. **Copilot CLI Integration** - commit message generation, context analysis
4. **Multilingual Support** - EN, FR, ES via i18next
5. **Adaptive Modes** - Beginner (verbose), Intermediate (tips), Expert (alerts only)
6. **Theme Toggle** - Colored/Monochrome
7. **Critical Error Prevention**:
   - Uncommitted changes warnings before checkout
   - Force push protection
   - Wrong branch alerts
   - Detached HEAD detection
8. **Expert Quick Mode** - Ctrl+Shift+G hotkey for rapid commit+push
9. **Basic Analytics** - Errors prevented, commits generated, time saved
10. **Persistent Configuration** - User preferences saved locally

### Nice to Have (If Time Permits)

- Interactive git log history
- Branch management wizards (merge, rebase)
- Stash helper
- Conflict resolution assistant
- Custom workflows
- Export reports

---

## Copilot CLI Integration Points

### 1. Commit Message Generation
```typescript
// Analyze diff and generate conventional commit message
const prompt = `Analyze git changes and generate conventional commit: ${diff}`;
await exec(`gh copilot suggest "${prompt}"`);
```

### 2. Context Analysis
```typescript
// Analyze current state and suggest next action
const prompt = `Current branch: ${branch}, files: ${files}. What should user do next?`;
await exec(`gh copilot suggest "${prompt}"`);
```

### 3. Error Prediction
```typescript
// Predict if action will cause problems
const prompt = `User wants to: ${action}. State: ${state}. Will this cause problems?`;
await exec(`gh copilot suggest "${prompt}"`);
```

### 4. Educational Explanations
```typescript
// Explain Git concepts for beginners
const prompt = `Explain to a beginner: ${concept}`;
await exec(`gh copilot suggest "${prompt}"`);
```

---

## i18n Keys Structure

All user-facing strings must use i18next keys:

```typescript
// Usage
import { t } from '../i18n';
console.log(t('menu.title'));
console.log(t('warnings.uncommitted'));
console.log(t('warnings.wrongBranch', { branch: 'main' }));
```

Key namespaces:
- `menu.*` - Menu items and titles
- `commands.*` - Git command descriptions
- `warnings.*` - Warning messages
- `errors.*` - Error messages
- `success.*` - Success messages
- `setup.*` - First-time setup strings
- `stats.*` - Analytics dashboard strings

---

## Code Style Guidelines

1. **TypeScript Strict Mode** - Enable all strict checks
2. **No Console.log** - Use logger utility instead
3. **Async/Await** - Prefer over raw promises
4. **Error Handling** - Always wrap external calls in try/catch
5. **Single Responsibility** - One function, one purpose
6. **Descriptive Names** - Self-documenting code
7. **Comments** - Only for complex logic, not obvious code
8. **Tests** - Unit test all services, integration test commands

---

## User Experience Principles

1. **Progressive Disclosure** - Show complexity only when needed
2. **Fail Gracefully** - Clear error messages with solutions
3. **Confirm Destructive Actions** - Always ask before force push, delete
4. **Quick Escape** - User can always cancel or go back
5. **Contextual Help** - Explain Git commands being executed
6. **Consistent Layout** - Same structure across all menus
7. **Responsive Feedback** - Loading states, success confirmations

---

## Testing Strategy

### Unit Tests
- All services (git-service, copilot-service, prevention-service)
- Utility functions
- i18n key completeness

### Integration Tests
- Command flows (init, config, main menu)
- Git operations with mock-git
- Copilot CLI responses (mocked)

### Manual Testing
- Test all 3 languages
- Test both themes
- Test all 3 experience levels
- Test on Windows, macOS, Linux

---

## Metrics to Track

### Development Metrics
- Test coverage > 70%
- Build time < 5s
- Bundle size < 2MB

### User Impact Metrics (tracked locally)
- Errors prevented (by type)
- Commits generated (AI vs manual)
- Time saved (estimated)
- User progression (level changes)

---

## Critical Deadlines

| Date | Milestone |
|------|-----------|
| Jan 22-28 | Week 1: Foundations + MVP Core |
| Jan 29 - Feb 4 | Week 2: Intelligence + Expert Mode |
| Feb 5-15 | Week 3: Polish + Docs + Submission |
| Feb 15, 23:59 PST | FINAL DEADLINE |

---

## Checklist Before Each Commit

- [ ] Code compiles without errors
- [ ] Tests pass
- [ ] ESLint shows no errors
- [ ] No console.log statements
- [ ] i18n keys exist in all 3 languages
- [ ] Complex logic is commented

---

## Checklist Before Submission

### Code
- [ ] All MVP features work
- [ ] Tests pass (unit + integration)
- [ ] Zero critical bugs
- [ ] Performance OK (menus < 100ms)
- [ ] Copilot CLI integration robust

### Quality
- [ ] ESLint zero errors
- [ ] TypeScript strict mode
- [ ] Code formatted (Prettier)
- [ ] Dependencies up to date
- [ ] No secrets in code

### Documentation
- [ ] README complete
- [ ] Installation guide tested
- [ ] Usage examples with screenshots
- [ ] CHANGELOG updated

### Package
- [ ] package.json complete
- [ ] Version 1.0.0
- [ ] License MIT
- [ ] Published on npm

### Demo
- [ ] Video demo (2-3 min)
- [ ] GIFs for README
- [ ] DEV.to article published

---

## Contingency: Minimum Viable Submission

If behind schedule, prioritize in this order:

**Priority 1 (MUST SHIP):**
- Basic menu + git operations
- Copilot CLI commit generation
- English only
- Beginner mode only
- Colored theme only
- Uncommitted changes warning

**Priority 2 (Add if time):**
- FR/ES languages
- Expert mode
- Analytics
- Monochrome theme

**Priority 3 (Nice to have):**
- Advanced features
- UX polish

---

## Resources

- [Oclif Documentation](https://oclif.io/docs/introduction)
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js)
- [simple-git](https://github.com/steveukx/git-js)
- [i18next](https://www.i18next.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Copilot CLI](https://docs.github.com/en/copilot/github-copilot-in-the-cli)

---

## Notes for Claude Code

- Always run `npm run lint` before suggesting code is complete
- Prefer composition over inheritance
- Keep functions under 30 lines when possible
- Use early returns to reduce nesting
- Handle edge cases: no git repo, no Copilot CLI, offline mode
- Test Copilot CLI availability before using it
- All user-facing output goes through the UI components (not raw console)
- Theme colors are abstracted - never hardcode ANSI codes
- Config changes must persist across sessions

---

## Mantra

> "Make it work, make it right, make it fast" - but SHIP on time.
