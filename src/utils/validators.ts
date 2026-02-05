export function isValidBranchName(name: string): boolean {
  if (!name || name.trim().length === 0) {
    return false;
  }

  // Git branch naming rules
  const invalidPatterns = [
    /^\./, // Cannot start with a dot
    /\.\.$/, // Cannot end with ..
    /\.lock$/, // Cannot end with .lock
    /^-/, // Cannot start with a dash
    /\s/, // Cannot contain whitespace
    /~/, // Cannot contain tilde
    /\^/, // Cannot contain caret
    /:/, // Cannot contain colon
    /\?/, // Cannot contain question mark
    /\*/, // Cannot contain asterisk
    /\[/, // Cannot contain open bracket
    /\\/, // Cannot contain backslash
    /\/\//, // Cannot contain double slash
    /\/$/, // Cannot end with slash
    /^\//, // Cannot start with slash
    /@\{/, // Cannot contain @{
  ];

  for (const pattern of invalidPatterns) {
    if (pattern.test(name)) {
      return false;
    }
  }

  return true;
}

const MIN_COMMIT_MESSAGE_LENGTH = 3;
const MAX_COMMIT_FIRST_LINE_LENGTH = 100;

export function isValidCommitMessage(message: string): boolean {
  if (!message || message.trim().length === 0) {
    return false;
  }

  // Minimum length check
  if (message.trim().length < MIN_COMMIT_MESSAGE_LENGTH) {
    return false;
  }

  // Maximum length for first line (conventional commits)
  const firstLine = message.split('\n')[0];
  if (firstLine.length > MAX_COMMIT_FIRST_LINE_LENGTH) {
    return false;
  }

  return true;
}

export function isConventionalCommit(message: string): boolean {
  // Conventional commit format: type(scope)?: description
  const conventionalPattern = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9-]+\))?!?:\s.+/i;
  return conventionalPattern.test(message.split('\n')[0]);
}

export function validateFilePath(filePath: string): { valid: boolean; error?: string } {
  if (!filePath || filePath.trim().length === 0) {
    return { valid: false, error: 'File path cannot be empty' };
  }

  // Check for invalid characters on Windows
  const invalidChars = /[<>"|?*]/;
  if (invalidChars.test(filePath)) {
    return { valid: false, error: 'File path contains invalid characters' };
  }

  return { valid: true };
}

export function isValidRemoteUrl(url: string): boolean {
  if (!url || url.trim().length === 0) {
    return false;
  }

  // HTTPS URL pattern
  const httpsPattern = /^https:\/\/.+\/.+\.git$/;

  // SSH URL pattern
  const sshPattern = /^git@.+:.+\/.+\.git$/;

  // Alternative SSH pattern
  const sshAltPattern = /^ssh:\/\/.+\/.+\.git$/;

  return httpsPattern.test(url) || sshPattern.test(url) || sshAltPattern.test(url);
}

export function sanitizeInput(input: string): string {
  // Remove potential shell injection characters
  return input.replace(/[;&|`$(){}[\]<>\\]/g, '');
}
