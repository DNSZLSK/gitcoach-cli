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

---

## Why GitCoach?

Git is powerful but brutal to beginners. Cryptic error messages, lost work from uncommitted changes, fear of breaking everything.

**GitCoach is different:**

- **Prevents mistakes BEFORE they happen** - Warns about uncommitted changes, detached HEAD, force push risks
- **Educational** - Shows every Git command being executed so you learn while you use it
- **Adapts to your level** - Beginner (verbose), Intermediate (balanced), Expert (minimal)
- **Multilingual** - Works in English, French, and Spanish
- **Optional AI features** - Can use GitHub Copilot CLI for commit messages and Git Q&A (works without it too)

Built for the **GitHub Copilot CLI Challenge 2026**.

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

For AI-powered commit messages and Git Q&A:

```bash
npm install -g @githubnext/github-copilot-cli
github-copilot-cli auth
```

GitCoach works perfectly fine without Copilot CLI - all core features are available.

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

Example in Expert mode:
```
? Main Menu
> [S] git status
  [A] git add
  [C] git commit
  [P] git push
  [L] git pull
```

### Error Prevention

GitCoach warns you BEFORE you make mistakes:

**Uncommitted changes:**
```
+------------------- Warning --------------------+
|                                                |
|  You have uncommitted changes!                 |
|  Switching branches will lose your work.       |
|                                                |
+------------------------------------------------+
```

**Detached HEAD:**
```
+--------------- Detached HEAD ------------------+
|                                                |
|  You are in detached HEAD state.               |
|  Your commits may be lost if you switch        |
|  branches without creating a new branch.       |
|                                                |
+------------------------------------------------+

? How do you want to resolve this?
> [C] Create a new branch
  [M] Return to main branch
  [S] Stash changes and return
  [I] Ignore (advanced users)
```

**Force push:**
```
? You are about to FORCE PUSH. This rewrites remote history.
? Are you absolutely sure? (yes/no)
```

### Educational Mode

Every action shows the Git command being executed:

```
? Stage all files? Yes
  > git add -A
  5 file(s) staged successfully.
```

You learn Git while using GitCoach.

### Smart Commits (Optional AI)

If you have GitHub Copilot CLI installed, GitCoach can generate commit messages:

```
? Generate message with AI? Yes
  Generating...

  Suggested: feat(auth): add OAuth2 authentication

? Use this message? (Y/n)
```

Without Copilot CLI, you write commit messages manually (conventional commits format suggested).

### Git Q&A (Optional AI)

Ask Git questions if Copilot CLI is installed:

```
? Your question: What's the difference between merge and rebase?

  MERGE creates a merge commit, preserving history.
  REBASE rewrites history by moving commits.
  Use merge for shared branches, rebase for local cleanup.
```

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
- **Jest** - 383 tests

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
├── test/             # 383 tests
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
- **Issues:** [github.com/DNSZLSK/gitcoach-cli/issues](https://github.com/DNSZLSK/gitcoach-cli/issues)

---

## Author

**DNSZLSK** - CDA Student at AFPA, France

Built for the [GitHub Copilot CLI Challenge 2026](https://dev.to/challenges/github).

---

## License

MIT/ /   G i t C o a c h   D e m o  
 