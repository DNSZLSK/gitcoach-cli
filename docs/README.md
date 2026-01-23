# GitSense

**Your AI-Powered Git Coach**

GitSense is an interactive CLI tool that helps developers master Git through guided menus, intelligent suggestions, and real-time error prevention. Built for the GitHub Copilot CLI Challenge.

## Features

- **Interactive Menus**: Spring Boot CLI-inspired navigation for all Git operations
- **AI Commit Messages**: Generate conventional commit messages using GitHub Copilot CLI
- **Error Prevention**: Warnings before dangerous operations (force push, uncommitted changes, etc.)
- **Multilingual**: Support for English, French, and Spanish
- **Adaptive Modes**: Beginner, Intermediate, and Expert experience levels
- **Themes**: Colored and Monochrome display options
- **Analytics**: Track your Git usage and see errors prevented

## Quick Start

```bash
# Install globally
npm install -g gitsense

# Run in any Git repository
gitsense

# Quick commit and push (expert mode)
gitsense quick -m "feat: add new feature"
```

## Commands

| Command | Description |
|---------|-------------|
| `gitsense` | Launch interactive main menu |
| `gitsense init` | First-time setup wizard |
| `gitsense config` | Configure settings |
| `gitsense quick` | Quick commit and push |
| `gitsense stats` | View your statistics |

## Main Menu Options

- **[S] Status** - View current changes in your repository
- **[A] Add** - Stage files for commit
- **[C] Commit** - Create a commit with staged changes
- **[P] Push** - Upload commits to remote repository
- **[L] Pull** - Download changes from remote repository
- **[B] Branch** - Create, switch, or delete branches
- **[G] Config** - Change language, theme, and preferences
- **[T] Stats** - View your GitSense statistics
- **[H] Help** - Get assistance
- **[Q] Quit** - Exit GitSense

## Experience Levels

### Beginner
- Verbose explanations for every action
- Step-by-step guidance
- Educational tips after operations

### Intermediate
- Helpful tips with moderate explanations
- Conventional commit suggestions

### Expert
- Minimal output, only warnings and errors
- Quick mode available (Ctrl+Shift+G hotkey concept)

## Error Prevention

GitSense protects you from common Git mistakes:

- **Uncommitted Changes**: Warning before checkout that would lose changes
- **Force Push**: Confirmation required with explanation of risks
- **Wrong Branch**: Alert when operating on unexpected branch
- **Detached HEAD**: Warning with guidance to create a branch
- **No Remote**: Information when no remote is configured

## Languages

- English (en)
- French (fr)
- Spanish (es)

Change language anytime in the Config menu.

## Themes

- **Colored**: Syntax highlighting with colors
- **Monochrome**: Plain text output

## GitHub Copilot CLI Integration

GitSense leverages GitHub Copilot CLI for:

1. **Commit Message Generation**: Analyzes your diff and suggests conventional commit messages
2. **Context Analysis**: Suggests next actions based on repository state
3. **Error Prediction**: Warns about potential issues before they occur

Requires GitHub Copilot CLI to be installed and authenticated.

## Tech Stack

- TypeScript
- Oclif (CLI framework)
- Inquirer.js (Interactive prompts)
- simple-git (Git operations)
- i18next (Internationalization)
- Chalk (Colors)
- Boxen (Boxes)
- Conf (Persistent configuration)

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
./bin/run.js

# Run tests
npm test

# Link globally for testing
npm link
```

## License

MIT
