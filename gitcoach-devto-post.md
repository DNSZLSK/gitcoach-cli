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

<!-- Replace these placeholders with your actual screenshots/GIFs -->

### Main Menu & Status Bar

![GitCoach main menu](YOUR_SCREENSHOT_URL_HERE)

*GitCoach launches with a real-time status bar showing branch, sync state, and pending changes. Every menu option maps to a Git workflow.*

### AI Diff Summary Before Commit

![Diff summary](YOUR_SCREENSHOT_URL_HERE)

*Before you write a commit message, Copilot CLI analyzes your staged changes and shows a human-readable summary of what you're about to commit. No more guessing.*

### Copilot-Assisted Conflict Resolution

![Conflict resolution with Copilot](YOUR_SCREENSHOT_URL_HERE)

*When a merge conflict hits, GitCoach lists each conflicting file and offers 5 options — including "Ask Copilot AI." Copilot reads both versions of the conflicting file and recommends a resolution strategy (keep local, keep remote, or a custom merge) with an explanation of why.*

### AI Commit Message Generation

![Commit message generation](YOUR_SCREENSHOT_URL_HERE)

*Copilot CLI analyzes your diff and generates a conventional commit message. You can accept, edit, or write your own.*

### Git Q&A — Ask Anything

![Git Q&A](YOUR_SCREENSHOT_URL_HERE)

*Don't know what `rebase` does? Ask directly from the menu. Copilot CLI answers in your configured language.*

## My Experience with GitHub Copilot CLI

I integrated GitHub Copilot CLI into GitCoach in **5 distinct ways**, each solving a different problem in the Git learning workflow:

### 1. Commit Message Generation

When a user stages changes and chooses to commit, GitCoach runs `git diff --cached` and sends it to Copilot CLI with a prompt asking for a concise conventional commit message. The user sees the suggestion, can accept it, edit it, or write their own. This teaches commit message best practices by example.

### 2. Git Q&A

From the main menu, users can type any Git-related question in natural language. Copilot CLI answers directly in the terminal, in the user's configured language. I found this particularly useful for concepts like "what's the difference between merge and rebase?" — questions that beginners need answered in context, not in a browser tab.

### 3. Staged Diff Summary (new in v1.1.0)

Before committing, GitCoach now shows a Copilot-generated summary of all staged changes. This is the feature I'm most proud of from a UX perspective — it gives the user a "second pair of eyes" moment before they commit. Copilot receives the full diff and returns a structured summary: files changed, what was added/modified/removed, and the overall intent of the changes.

### 4. Contextual Error Explanation (new in v1.1.0)

When a Git operation fails (push rejected, merge conflict, authentication error), GitCoach catches the error and sends it to Copilot CLI for a plain-language explanation. The user sees both the static, pre-written explanation from GitCoach AND an AI-generated one specific to their exact error. This two-layer approach means the tool works without internet (static messages) but provides richer context when Copilot is available.

### 5. AI-Assisted Conflict Resolution (new in v1.1.0)

This is the flagship integration. When merge conflicts occur, GitCoach already provides a guided resolution menu with options like "Accept local changes," "Accept remote changes," or "Open in editor." The v1.1.0 update adds a 5th option: **"Ask Copilot AI."**

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

During development I hit a compatibility issue: the version of `@githubnext/github-copilot-cli` bundled in my environment (0.0.393) had breaking changes compared to 0.0.404. The newer version changed how interactive payloads work. Upgrading manually fixed the issue, but it's worth noting for anyone building on top of Copilot CLI — pin your versions.

---

GitCoach started as my way of learning Git properly during a career transition into software development. I built it because the tools I wanted didn't exist — something between "read the docs" and "just use a GUI client." Adding Copilot CLI turned it from a useful learning tool into something that genuinely adapts to the user's situation. The AI doesn't replace the education — it enhances it.

**Try it:** `npm install -g gitcoach-cli` then run `gitcoach` in any Git repository.
