# CLAUDE.md - GitCoach Project

## Project Overview

**GitCoach** is an AI-powered Git coach CLI that prevents mistakes before they happen. Built for the GitHub Copilot CLI Challenge (deadline: February 15, 2025, 23:59 PST).

**Core Problem:** Beginners lose work from Git mistakes; developers waste time searching for solutions; commit messages are generic.

**Solution:** Interactive multilingual CLI with guided menus for beginners, quick shortcuts for experts, contextual analysis via Copilot CLI, real-time error prevention, and intelligent commit generation.

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
| Analytics | Local SQLite |
| Testing | Jest + mock-git |

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
