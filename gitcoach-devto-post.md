---
title: GitCoach — The Git Mentor That Teaches You While You Work (GitHub Copilot CLI Challenge)
published: false
tags: devchallenge, githubchallenge, cli, githubcopilot
---

This is a submission for the [GitHub Copilot CLI Challenge](https://dev.to/challenges/github-2026-01-21)

## What I Built

**GitCoach** is an interactive CLI tool that replaces raw Git commands with guided, educational menus — and uses GitHub Copilot CLI as its AI backbone for 5 distinct features.

The problem it solves is simple: Git is powerful but hostile to learners. Beginners memorize commands without understanding them. When something breaks — a merge conflict, a detached HEAD, a failed push — they're on their own with cryptic error messages.

GitCoach wraps Git in a TUI that:

- **Shows what's happening** — a status bar with branch, sync status, and staged changes at all times
- **Prevents mistakes** — warns before destructive actions, detects detached HEAD state, catches uncommitted changes before branch switching
- **Teaches as it goes** — every action shows the underlying Git command so you learn while you work
- **Guides conflict resolution step by step** — instead of dumping conflict markers on the user, GitCoach walks through each conflicting file with clear options and explanations
- **Speaks your language** — full i18n support for English, French, and Spanish

The key idea: GitCoach should make itself obsolete. You use it to learn, and eventually you don't need it anymore.

### Tech Stack

- TypeScript, Node.js
- Published on npm: `npm install -g gitcoach-cli`
- 522 tests passing
- GitHub Copilot CLI (5 integrations — more on that below)

**GitHub repo:** [github.com/DNSZLSK/gitcoach-cli](https://github.com/DNSZLSK/gitcoach-cli)
**npm:** [npmjs.com/package/gitcoach-cli](https://www.npmjs.com/package/gitcoach-cli)

## Demo

### Main Menu & Status Bar

![GitCoach main menu](MenuBeginner.png)

GitCoach launches with a real-time status bar showing branch, sync state, and pending changes. Every menu option maps to a Git workflow. The `~1 ?1` indicators tell you at a glance: 1 modified file, 1 untracked file.

### Commit Flow

![Commit flow](commit.png)

When committing, GitCoach lists staged files, shows educational tips about writing good commit messages, and integrates with Copilot CLI to generate or summarize changes before you commit.

### Copilot-Assisted Conflict Resolution

![Conflict resolution with Copilot](mergeConflict.png)

This is the flagship feature. When a merge conflict occurs, GitCoach detects it, shows both versions side by side (local vs remote), and offers 5 resolution options — including **"Ask Copilot AI."** In this example, Copilot analyzed both versions and recommended a CUSTOM merge, explaining that neither version alone was correct and suggesting a merged version that maintains backward compatibility while accommodating the feature branch changes.

### Git Q&A — Ask Anything

![Git Q&A](question.png)

Don't know what `rebase` does? Ask directly from the Help menu. Copilot CLI answers in detail with examples and rules of thumb — all without leaving the terminal, and in your configured language.

## My Experience with GitHub Copilot CLI

I integrated GitHub Copilot CLI into GitCoach in **5 distinct ways**, each solving a different problem in the Git learning workflow:

### 1. Commit Message Generation

When a user stages changes and chooses to commit, GitCoach runs `git diff --cached` and sends it to Copilot CLI with a prompt asking for a concise conventional commit message. The user sees the suggestion, can accept it, edit it, or write their own. This teaches commit message best practices by example.

### 2. Git Q&A

From the Help menu, users can type any Git-related question in natural language. Copilot CLI answers directly in the terminal, in the user's configured language. I found this particularly useful for concepts like "what's the difference between merge and rebase?" — questions that beginners need answered in context, not in a browser tab.

### 3. Staged Diff Summary

Before committing, GitCoach can show a Copilot-generated summary of all staged changes. This gives the user a "second pair of eyes" moment before they commit. Copilot receives the full diff and returns a structured summary: files changed, what was added/modified/removed, and the overall intent of the changes.

### 4. Contextual Error Explanation

When a Git operation fails (push rejected, merge conflict, authentication error), GitCoach catches the error and sends it to Copilot CLI for a plain-language explanation. The user sees both the static, pre-written explanation from GitCoach AND an AI-generated one specific to their exact error. This two-layer approach means the tool works without internet (static messages) but provides richer context when Copilot is available.

### 5. AI-Assisted Conflict Resolution

This is the flagship integration. When merge conflicts occur, GitCoach already provides a guided resolution menu with options like "Accept local changes," "Accept remote changes," or "Open in editor." The 5th option is **"Ask Copilot AI."**

When selected, GitCoach reads both the local and remote versions of the conflicting file and sends them to Copilot CLI with context about the conflict. Copilot responds with:
- A **recommendation** (LOCAL, REMOTE, BOTH, or CUSTOM)
- An **explanation** of why that strategy makes sense
- If CUSTOM, the actual **merged content** ready to apply

In testing, Copilot correctly identified that one branch had a version bump while the other had a name change, and recommended a custom merge keeping both modifications. That's not trivial — it understood the semantic intent of each change.

### Language-Aware Responses

All 5 Copilot integrations respect the user's language configuration. A `getLanguageInstruction()` function appends the appropriate instruction ("Respond in French", "Responde en español") to every prompt. Copilot's responses come back in the right language, which matters a lot for the educational mission of the tool.

### The Parsing Challenge

One real challenge was parsing Copilot CLI's output reliably. Copilot sometimes returns error messages, version warnings, or unexpected formatting mixed in with actual responses. I built a `looksLikeError()` detection function that filters out common Copilot error patterns so the UI never shows raw error text to the user. If Copilot fails silently, GitCoach falls back to its static educational content — the user experience is never broken.

### Copilot CLI Version Gotcha

During development I hit a compatibility issue with the deprecated `gh copilot` extension vs the newer standalone `copilot` CLI. The migration required updating all command invocations and install instructions. It's worth noting for anyone building on top of Copilot CLI — make sure you're using the current `copilot` command, not the deprecated `gh copilot` extension.

---

GitCoach started as my way of learning Git properly during a career transition into software development. I built it because the tools I wanted didn't exist — something between "read the docs" and "just use a GUI client." Adding Copilot CLI turned it from a useful learning tool into something that genuinely adapts to the user's situation. The AI doesn't replace the education — it enhances it.

**Try it:** `npm install -g gitcoach-cli` then run `gitcoach` in any Git repository.
