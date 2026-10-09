---
name: git-workflow-review
description: >-
  Use this skill when preparing git commits, reviewing git diffs, writing PR descriptions, or organizing version control history.
---

# Git Workflow & Conventional Commits Guide

Maintain clean, atomic, and readable version control history.

## 1. Pre-Commit Review Checklist
Before staging or committing changes:
1. Run `git status` to check all untracked and modified files.
2. Run `git diff` to inspect modifications line by line:
   * Remove any temporary debug logs (`console.log`, `print`, `debugger`).
   * Confirm no sensitive secrets, `.env` files, or temporary artifacts are staged.
   * Ensure formatters and linters pass (`npm run lint` or `npm run build`).

## 2. Conventional Commit Format
Write commit messages following the Conventional Commits specification:

```text
<type>(<optional scope>): <short summary in present tense>

[optional body providing context and reasoning]

[optional footer(s), e.g. Closes #123]
```

### Allowed Types:
* `feat`: A new user-facing feature or enhancement.
* `fix`: A bug fix for the user or system.
* `refactor`: Code change that neither fixes a bug nor adds a feature.
* `perf`: Code change that improves performance.
* `test`: Adding missing tests or correcting existing tests.
* `style`: Formatting, missing semi-colons, white-space changes (no logic change).
* `docs`: Documentation only changes.
* `chore`: Build process, auxiliary tools, dependency updates.

## 3. Pull Request Description Template
When creating a PR or summarizing a batch of work:
* **Context**: Why was this change needed?
* **Changes Made**: Bullet list of key modifications.
* **Testing & Verification**: How the changes were tested and verified.
