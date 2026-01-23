# Installation Guide

## Prerequisites

- Node.js 18.0.0 or higher
- Git installed and in PATH
- (Optional) GitHub Copilot CLI for AI features

## Install from npm

```bash
npm install -g gitcoach
```

## Install from Source

1. Clone the repository:
```bash
git clone https://github.com/your-username/gitcoach.git
cd gitcoach
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Link globally:
```bash
npm link
```

## Verify Installation

```bash
gitcoach --help
```

You should see the GitCoach help output with available commands.

## GitHub Copilot CLI Setup (Optional)

For AI-powered commit message generation:

1. Install GitHub CLI:
```bash
# Windows (winget)
winget install GitHub.cli

# macOS (Homebrew)
brew install gh

# Linux (apt)
sudo apt install gh
```

2. Authenticate with GitHub:
```bash
gh auth login
```

3. Install Copilot CLI extension:
```bash
gh extension install github/gh-copilot
```

4. Verify Copilot CLI:
```bash
gh copilot --version
```

## First Run

When you first run `gitcoach`, you'll be guided through setup:

1. Select your preferred language (English, French, Spanish)
2. Choose your theme (Colored or Monochrome)
3. Select your experience level (Beginner, Intermediate, Expert)

You can change these settings anytime using `gitcoach config`.

## Troubleshooting

### "Not a Git repository" error

Make sure you're running GitCoach inside a Git repository:
```bash
cd your-project
git init  # if not already a repo
gitcoach
```

### "GitHub Copilot CLI is not available"

This warning appears if Copilot CLI isn't installed. GitCoach will still work, but AI features will be disabled.

### Permission denied on Linux/macOS

Make sure the bin script is executable:
```bash
chmod +x ./bin/run.js
```
