# GitCoach

```
    ██████╗ ██╗████████╗ ██████╗ ██████╗  █████╗  ██████╗██╗  ██╗
   ██╔════╝ ██║╚══██╔══╝██╔════╝██╔═══██╗██╔══██╗██╔════╝██║  ██║
   ██║  ███╗██║   ██║   ██║     ██║   ██║███████║██║     ███████║
   ██║   ██║██║   ██║   ██║     ██║   ██║██╔══██║██║     ██╔══██║
   ╚██████╔╝██║   ██║   ╚██████╗╚██████╔╝██║  ██║╚██████╗██║  ██║
    ╚═════╝ ╚═╝   ╚═╝    ╚═════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
```

**The AI-powered Git coach that prevents mistakes before they happen.**

[![npm version](https://img.shields.io/npm/v/gitcoach-cli)](https://www.npmjs.com/package/gitcoach-cli)
[![GitHub](https://img.shields.io/github/stars/DNSZLSK/gitcoach-cli?style=social)](https://github.com/DNSZLSK/gitcoach-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Why GitCoach?

Git is powerful but brutal to beginners. Cryptic error messages, lost work from uncommitted changes, fear of breaking everything.

**GitCoach is different:**

- **Prevents mistakes BEFORE they happen** - Warns about uncommitted changes, detached HEAD, force push risks
- **Educational** - Shows every Git command being executed so you learn while you use it
- **AI-powered** - Uses GitHub Copilot CLI to generate smart commit messages and answer Git questions
- **Multilingual** - Works in English, French, and Spanish
- **Beginner-friendly** - No more cryptic error messages

Built for the **GitHub Copilot CLI Challenge 2026**.

---

## Quick Start

```bash
# Install globally
npm install -g gitcoach-cli

# Run in any Git repository
gitcoach
```

That's it. GitCoach guides you from there.

---

## Prerequisites

Before installing GitCoach, you need Node.js and Git installed on your system.

### 1. Node.js (version 18 or higher)

**Windows:**
1. Download the LTS version from [nodejs.org](https://nodejs.org/)
2. Run the installer
3. Restart your terminal

**Mac:**
```bash
brew install node
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Verify installation:**
```bash
node --version    # Should show v18.x.x or higher
npm --version     # Should show 9.x.x or higher
```

### 2. Git

**Windows:**
1. Download from [git-scm.com](https://git-scm.com/download/win)
2. Run the installer with default options
3. Restart your terminal

**Mac:**
```bash
brew install git
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install git
```

**Verify installation:**
```bash
git --version    # Should show git version 2.x.x
```

### 3. GitHub Copilot CLI (Optional - for AI features)

GitCoach works without Copilot CLI, but AI-powered commit messages and Git Q&A require it.

```bash
npm install -g @githubnext/github-copilot-cli
```

Then authenticate:
```bash
github-copilot-cli auth
```

---

## Features

### Interactive Menus

No more memorizing commands. Navigate Git with simple menus.

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
  [?] Help     - Ask Git questions (AI)
```

### AI-Powered Commits

GitCoach uses GitHub Copilot CLI to analyze your changes and generate meaningful commit messages following conventional commits format.

```
? Generate message with AI? Yes
  Generating...

+--------------- Suggested message ---------------+
|                                                 |
|   feat(auth): add OAuth2 user authentication    |
|                                                 |
+-------------------------------------------------+

? Use this message? (Y/n)
```

### Error Prevention

GitCoach warns you BEFORE you make mistakes:

**Uncommitted changes protection:**
```
+------------------- Warning --------------------+
|                                                |
|  You have uncommitted changes!                 |
|  Switching branches will lose your work.       |
|                                                |
|  Recommended: Commit or stash first.           |
|                                                |
+------------------------------------------------+
```

**Detached HEAD detection:**
```
+--------------- Detached HEAD ------------------+
|                                                |
|  You are in detached HEAD state.               |
|  This means you are not on any branch.         |
|                                                |
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

**Force push confirmation:**
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

You learn Git while using GitCoach. Eventually, you won't need it anymore. That's the goal.

### Ask Git Questions

Don't know what a rebase is? Just ask.

```
? Your question: What's the difference between merge and rebase?
  Thinking...

+------------------- Answer ---------------------+
|                                                |
|  Both integrate changes from one branch        |
|  into another, but differently:                |
|                                                |
|  MERGE creates a merge commit, preserving      |
|  history as it happened.                       |
|                                                |
|  REBASE rewrites history by moving your        |
|  commits on top of the target branch.          |
|                                                |
|  Use merge for shared branches.                |
|  Use rebase for local cleanup.                 |
|                                                |
+------------------------------------------------+
```

### Conflict Resolution

When merge conflicts occur, GitCoach guides you through resolution:

```
+------------ Merge Conflicts Detected ----------+
|                                                |
|  A conflict occurs when the same file was      |
|  modified both locally and on the server.      |
|  Git cannot automatically merge these changes. |
|                                                |
+------------------------------------------------+

Conflicting files:
  - src/index.ts
  - README.md

? How do you want to resolve?
> [V] View conflicts
  [O] Open in editor
  [A] Accept local changes (--ours)
  [T] Accept remote changes (--theirs)
  [M] Mark as resolved
  [X] Abort merge
```

### Branch Management

Create, switch, merge, and delete branches with guidance:

```
? Select an option
> [C] Create a new branch
  [S] Switch branch
  [F] Merge a branch
  [D] Delete a branch
  [R] Return
```

**Merge with explanation:**
```
+--------------- What is Merge? -----------------+
|                                                |
|  Merging combines the changes from one branch  |
|  into another. All commits from the source     |
|  branch will be integrated into your current   |
|  branch.                                       |
|                                                |
+------------------------------------------------+

You are on 'main'. Which branch do you want to merge here?
> feature/login
  feature/dashboard
  bugfix/header

This will execute: git merge feature/login
? Continue? (Y/n)
```

### Multilingual Support

Switch between English, French, and Spanish anytime.

```
? Select language:
> English
  Francais
  Espanol

Configuration updated.
Bienvenue dans GitCoach !
```

Localized confirmations:
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

## Configuration

GitCoach adapts to your experience level:

| Level | Description |
|-------|-------------|
| **Beginner** | Verbose explanations, step-by-step guidance, all warnings |
| **Intermediate** | Helpful tips, conventional commit suggestions |
| **Expert** | Minimal output, critical warnings only |

Change your level anytime:
```bash
gitcoach config
```

---

## Tech Stack

- **TypeScript** - Type-safe code
- **Inquirer.js** - Interactive prompts
- **simple-git** - Git operations
- **GitHub Copilot CLI** - AI features
- **i18next** - Internationalization
- **Chalk** - Terminal styling
- **Jest** - Testing

---

## Development

```bash
# Clone the repository
git clone https://github.com/DNSZLSK/gitcoach-cli.git
cd gitcoach-cli

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run locally
./bin/run.js

# Link globally for testing
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
├── test/             # Test files
└── docs/             # Documentation
```

---

## Contributing

Contributions welcome! Please:

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

**DNSZLSK**

CDA Student at AFPA, France.

Built for the [GitHub Copilot CLI Challenge 2026](https://dev.to/challenges/github).

---

## License

MIT - See [LICENSE](LICENSE) for details.