# GitCoach


```
   ██████╗ ██╗████████╗ ██████╗ ██████╗  █████╗  ██████╗██╗  ██╗
  ██╔════╝ ██║╚══██╔══╝██╔════╝██╔═══██╗██╔══██╗██╔════╝██║  ██║
  ██║  ███╗██║   ██║   ██║     ██║   ██║███████║██║     ███████║
  ██║   ██║██║   ██║   ██║     ██║   ██║██╔══██║██║     ██╔══██║
  ╚██████╔╝██║   ██║   ╚██████╗╚██████╔╝██║  ██║╚██████╗██║  ██║
   ╚═════╝ ╚═╝   ╚═╝    ╚═════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
```

 

**Interactive Git assistant that prevents mistakes before they happen.**

[![npm version](https://img.shields.io/npm/v/gitcoach-cli)](https://www.npmjs.com/package/gitcoach-cli)
[![GitHub](https://img.shields.io/github/stars/DNSZLSK/gitcoach-cli?style=social)](https://github.com/DNSZLSK/gitcoach-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-522%20passing-brightgreen)](https://github.com/DNSZLSK/gitcoach-cli)

---

## Why GitCoach?

Git is powerful but brutal to beginners. Cryptic error messages, lost work from uncommitted changes, fear of breaking everything.

**GitCoach is different:**

- **Prevents mistakes BEFORE they happen** - Warns about uncommitted changes, detached HEAD, force push risks
- **Educational** - Shows every Git command being executed so you learn while you use it
- **Adapts to your level** - Beginner (verbose), Intermediate (balanced), Expert (minimal)
- **Multilingual** - Works in English, French, and Spanish
- **5 AI integrations** - Uses GitHub Copilot CLI for commit messages, Git Q&A, diff summaries, error explanations, and conflict resolution (works without it too)

Built for the **[GitHub Copilot CLI Challenge 2026](https://dev.to/challenges/github-2026-01-21)**.

---

## Quick Start

```bash
npm install -g gitcoach-cli
gitcoach
```

That's it. GitCoach guides you from there.

---

## Prerequisites

### 1. Node.js (version 18 or higher)

**Windows:**
Download from [nodejs.org](https://nodejs.org/) (LTS version)

**Mac:**
```bash
brew install node
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Git

**Windows:**
Download from [git-scm.com](https://git-scm.com/download/win)

**Mac:**
```bash
brew install git
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install git
```

### 3. GitHub Copilot CLI (Optional)

For AI-powered features (commit messages, Q&A, diff summaries, error explanations, conflict resolution):

```bash
npm install -g @github/copilot
copilot login
```

GitCoach works perfectly fine without Copilot CLI — all core features are available without it.

---

## Features

### Interactive Menus

Navigate Git with simple menus instead of memorizing commands.

```
? Main Menu
> [S] Status   - View current changes
  [A] Add      - Stage files for commit
  [C] Commit   - Save your changes
  [P] Push     - Upload to remote
  [L] Pull     - Download changes
  [B] Branch   - Manage branches
  [U] Undo     - Undo actions
  [H] History  - View commit history
  [W] Stash    - Save work temporarily
  [G] Config   - Configure GitCoach
  [?] Help     - Ask Git questions
  [Q] Quit     - Exit GitCoach
```

### Experience Levels

GitCoach adapts to your skill level:

| Level | Menu Labels | Confirmations | Warnings | Explanations |
|-------|-------------|---------------|----------|--------------|
| **Beginner** | Full descriptions | All | All | Shown |
| **Intermediate** | Short descriptions | All | Most | Hidden |
| **Expert** | Git commands | Destructive only | Critical only | Hidden |

### Error Prevention

GitCoach warns you BEFORE you make mistakes:

- **Uncommitted changes** — warns before branch switching
- **Detached HEAD** — detects and offers recovery options (create branch, return to main, stash)
- **Force push** — requires explicit confirmation
- **Merge conflicts** — guides you through resolution step by step

### Educational Mode

Every action shows the Git command being executed:

```
? Stage all files? Yes
  > git add -A
  5 file(s) staged successfully.
```

You learn Git while using GitCoach. Eventually, you won't need it anymore. That's the goal.

---

## GitHub Copilot CLI Integrations

GitCoach uses Copilot CLI in **5 distinct ways**. All are optional — the tool works without Copilot.

### 1. Smart Commit Messages

Copilot analyzes your staged diff and suggests a conventional commit message:

```
  Suggested: feat(auth): add OAuth2 authentication
? Use this message? (Y/n)
```

### 2. Git Q&A

Ask any Git question in natural language from the Help menu:

```
? Your question: What's the difference between merge and rebase?

  MERGE creates a merge commit, preserving history.
  REBASE rewrites history by moving commits.
  Use merge for shared branches, rebase for local cleanup.
```

### 3. Staged Diff Summary

Before committing, Copilot summarizes your staged changes so you can review the intent of your work before saving it:

```
+-------------- Summary of Changes ---------------+
|                                                  |
|  Modified auth module: added OAuth2 flow with    |
|  token refresh. Updated user model to store      |
|  refresh tokens.                                 |
|                                                  |
+--------------------------------------------------+
```

### 4. Contextual Error Explanation

When a Git operation fails, Copilot explains the error in plain language alongside GitCoach's built-in help:

```
  Error: failed to push some refs to 'origin/main'

+--------------- AI Explanation ------------------+
|                                                 |
|  Your local branch is behind the remote. Pull   |
|  the latest changes first with 'git pull', then |
|  try pushing again.                             |
|                                                 |
+-------------------------------------------------+
```

### 5. AI-Assisted Conflict Resolution

When merge conflicts occur, GitCoach shows both versions and offers 5 options — including asking Copilot for a recommendation:

```
  Your version (local):
    name: master-version

  Remote version:
    name: feature-version

? What do you want to keep?
> Keep my version (local)
  Keep the remote version
  Keep both (combine)
  Edit manually in my editor
  Ask Copilot AI              <-- Copilot analyzes both versions

  Copilot suggests: CUSTOM
  Neither version alone is correct. The optimal solution
  is to keep a merged version that maintains backward
  compatibility while accommodating the feature.

? Accept this suggestion? (Y/n)
```

All Copilot responses respect your language configuration (English, French, or Spanish).

---

### Branch Management

Create, switch, merge, and delete branches with guidance:

```
? Select an option
> Create a new branch
  Switch branch
  Merge a branch
  Delete a branch
  Back
```

### Multilingual Support

English, French, and Spanish. Localized confirmations:
- English: `(Y/n)`
- French: `(O/n)`
- Spanish: `(S/n)`

---

## Commands

| Command | Description |
|---------|-------------|
| `gitcoach` | Launch interactive menu |
| `gitcoach init` | First-time setup |
| `gitcoach config` | Change settings |
| `gitcoach stats` | View your statistics |

---

## Tech Stack

- **TypeScript** - Type-safe code
- **Inquirer.js** - Interactive prompts
- **simple-git** - Git operations
- **i18next** - Internationalization
- **Chalk** - Terminal styling
- **Jest** - 522 tests

---

## Development

```bash
git clone https://github.com/DNSZLSK/gitcoach-cli.git
cd gitcoach-cli
npm install
npm run build
npm test
npm link
gitcoach
```

---

## Project Structure

```
gitcoach-cli/
├── bin/              # CLI entry point
├── src/
│   ├── commands/     # CLI commands
│   ├── config/       # Configuration management
│   ├── i18n/         # Translations (en, fr, es)
│   ├── services/     # Git operations, Copilot integration
│   ├── ui/
│   │   ├── components/   # Reusable UI components
│   │   ├── menus/        # Interactive menus
│   │   └── themes/       # Color themes
│   └── utils/        # Helpers, validators
├── test/             # 522 tests
└── docs/             # Documentation
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Links

- **npm:** [npmjs.com/package/gitcoach-cli](https://www.npmjs.com/package/gitcoach-cli)
- **GitHub:** [github.com/DNSZLSK/gitcoach-cli](https://github.com/DNSZLSK/gitcoach-cli)
- **DEV.to:** [GitCoach — GitHub Copilot CLI Challenge](https://dev.to/dnszlsk/gitcoach-the-git-mentor-that-teaches-you-while-you-work-github-copilot-cli-challenge-1708)
- **Issues:** [github.com/DNSZLSK/gitcoach-cli/issues](https://github.com/DNSZLSK/gitcoach-cli/issues)

---

## Author

**DNSZLSK** — CDA Student at AFPA, France

Built for the [GitHub Copilot CLI Challenge 2026](https://dev.to/challenges/github-2026-01-21).

---

## License

MIT
 







