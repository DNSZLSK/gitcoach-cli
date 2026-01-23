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

[![GitHub](https://img.shields.io/github/stars/DNSZLSK/gitcoach?style=social)](https://github.com/DNSZLSK/gitcoach)
[![npm version](https://img.shields.io/npm/v/gitcoach-cli)](https://www.npmjs.com/package/gitcoach-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Why GitCoach?

Git is powerful but brutal to beginners. Cryptic error messages, lost work from uncommitted changes, fear of breaking everything.

**GitCoach is different:**
- Prevents mistakes BEFORE they happen
- Shows you the Git commands being executed (learn while you do)
- Uses GitHub Copilot CLI to generate smart commit messages
- Answers your Git questions in plain language
- Works in English, French, and Spanish

Built for the **GitHub Copilot CLI Challenge 2026**.

---

## Quick Start

```bash
# Install globally
npm install -g gitcoach-cli

# Run in any directory
gitcoach

# That's it. GitCoach guides you from there.
```

---

## Requirements

- **Node.js** 18 or higher
- **Git** installed and configured
- **GitHub Copilot CLI** (optional, for AI features) - [Install here](https://github.com/github/copilot-cli)

---

## Features

### Interactive Menus
No more memorizing commands. Navigate Git with simple menus.

```
[S] Status   - View current changes
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
GitCoach uses GitHub Copilot CLI to analyze your changes and generate meaningful commit messages.

```
✔ Generate message with AI? Yes
✔ Generating...

╭─────────────── Suggested message ───────────────╮
│                                                 │
│   feat: add user authentication with OAuth2     │
│                                                 │
╰─────────────────────────────────────────────────╯

? Use this message? (Y/n)
```

### Error Prevention
GitCoach warns you before you make mistakes:

- **Uncommitted changes** before switching branches
- **Force push** requires double confirmation
- **Detached HEAD** with clear explanation
- **No upstream** detected on first push

```
┏━━━━━━━━━━━━━━━━━━━ Warning ━━━━━━━━━━━━━━━━━━━━┓
┃                                                ┃
┃  You have uncommitted changes!                 ┃
┃  Switching branches will lose your work.       ┃
┃                                                ┃
┃  Recommended: Commit or stash first.           ┃
┃                                                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Ask Git Questions
Don't know what a rebase is? Just ask.

```
✔ Your question: What's the difference between merge and rebase?
✔ Thinking...

╭─────────────────── Answer ───────────────────╮
│                                              │
│  Both integrate changes from one branch      │
│  into another, but differently:              │
│                                              │
│  **merge** creates a merge commit,           │
│  preserving history as it happened.          │
│                                              │
│  **rebase** rewrites history by moving       │
│  your commits on top of the target branch.   │
│                                              │
│  Use merge for shared branches.              │
│  Use rebase for local cleanup.               │
│                                              │
╰──────────────────────────────────────────────╯
```

### Educational
Every action shows the Git command being executed:

```
✔ Stage all files? Yes
  > git add -A
✔ 5 file(s) staged successfully.
```

You learn Git while using GitCoach. Eventually, you won't need it anymore. That's the goal.

### Multilingual
Switch between English, French, and Spanish anytime.

```
✔ Select language: Français
✔ Configuration updated.

Bienvenue dans GitCoach !
```

---

## Commands

| Command | Description |
|---------|-------------|
| `gitcoach` | Launch interactive menu |
| `gitcoach init` | First-time setup |
| `gitcoach config` | Change settings |
| `gitcoach quick -m "msg"` | Quick commit + push |
| `gitcoach stats` | View your statistics |

---

## Experience Levels

| Level | Description |
|-------|-------------|
| **Beginner** | Verbose explanations, step-by-step guidance |
| **Intermediate** | Helpful tips, conventional commit suggestions |
| **Expert** | Minimal output, warnings only |

Change your level anytime in Config.

---

## Tech Stack

- **TypeScript** - Type-safe code
- **Oclif** - CLI framework
- **Inquirer.js** - Interactive prompts
- **simple-git** - Git operations
- **GitHub Copilot CLI** - AI features
- **i18next** - Internationalization
- **Chalk** - Terminal colors
- **Jest** - 181 tests

---

## Development

```bash
# Clone
git clone https://github.com/DNSZLSK/gitcoach.git
cd gitcoach

# Install
npm install

# Build
npm run build

# Test
npm test

# Run locally
./bin/run.js

# Link globally
npm link
```

---

## Contributing

Contributions welcome! Please open an issue first to discuss what you'd like to change.

---

## Author

**DNSZLSK**

CDA Student at AFPA, France.

Built for the [GitHub Copilot CLI Challenge 2026](https://dev.to/challenges/github).

---

## License

MIT
