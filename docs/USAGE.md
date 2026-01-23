# Usage Guide

## Starting GitCoach

Navigate to any Git repository and run:

```bash
gitcoach
```

## Main Menu Navigation

Use arrow keys to navigate and Enter to select.

```
===== MAIN MENU =====

[S] Status - View changes
[A] Add - Stage files
[C] Commit - Save changes
[P] Push - Upload to remote
[L] Pull - Download changes
[B] Branch - Manage branches
---
[G] Config - Settings
[T] Stats - Statistics
[H] Help - Assistance
[Q] Quit - Exit
```

## Common Workflows

### Making a Commit

1. Select **[S] Status** to see your changes
2. Select **[A] Add** to stage files
3. Select **[C] Commit** to create a commit
   - GitCoach will offer to generate a message with AI
   - Or enter your own message

### Quick Commit and Push

For experienced users, use the quick command:

```bash
# Stage all, commit with AI message, and push
gitcoach quick --all

# Commit with specific message and push
gitcoach quick -m "feat: add user authentication"

# Commit without pushing
gitcoach quick -m "wip: work in progress" --no-push
```

### Branch Management

Select **[B] Branch** from the main menu:

- **List branches**: See all available branches
- **Create branch**: Create and checkout a new branch
- **Switch branch**: Change to a different branch (with safety checks)
- **Delete branch**: Remove a branch (with confirmation)

### Viewing Statistics

Select **[T] Stats** or run:

```bash
gitcoach stats
```

See:
- Total commits made
- Errors prevented
- AI-generated commits
- Estimated time saved

## Configuration Options

Access via **[G] Config** or:

```bash
gitcoach config
```

### Available Settings

| Setting | Description |
|---------|-------------|
| Language | English, French, Spanish |
| Theme | Colored or Monochrome |
| Experience Level | Beginner, Intermediate, Expert |
| Show Tips | Enable/disable helpful tips |
| Confirm Destructive | Require confirmation for dangerous actions |
| Auto Commit Messages | Enable AI commit message generation |

### Reset to Defaults

In the config menu, select "Reset to Defaults" to restore all settings.

## Safety Features

### Uncommitted Changes Warning

When switching branches with uncommitted changes:

```
WARNING: You have uncommitted changes that will be lost!
Commit or stash your changes before proceeding.
```

### Force Push Protection

Attempting a force push triggers:

```
WARNING: Force push will overwrite remote history!
This action cannot be undone.
Are you sure? (y/N)
```

### Detached HEAD Warning

When in detached HEAD state:

```
WARNING: You are in a detached HEAD state!
Create a branch to save your work.
```

## AI Commit Messages

When committing, GitCoach can generate messages:

1. Enable "Auto Commit Messages" in config
2. When committing, select "Generate commit message with AI"
3. Review the suggested message
4. Accept, edit, or enter your own

Example generated messages:
- `feat(auth): add JWT token validation`
- `fix(api): handle null response from server`
- `docs(readme): update installation instructions`

## Keyboard Shortcuts

- **Arrow keys**: Navigate menus
- **Enter**: Select option
- **Ctrl+C**: Exit/Cancel

## Tips by Experience Level

### Beginner Tips
- Always check status before committing
- Stage files with Add before committing
- Write clear commit messages explaining WHY
- Push regularly to back up your work
- Use branches for new features

### Intermediate Tips
- Use conventional commits (feat:, fix:, docs:)
- Consider rebasing for cleaner history
- Review diffs before committing

### Expert Tips
- Use `gitcoach quick` for rapid workflows
- Customize settings for minimal output
- Leverage AI for consistent commit messages
