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

/**
 * Tags and branches are both refs, so git applies the same name rules to each.
 * The extra restriction here is that a tag may not end in a dot, which git
 * rejects for refs but which `isValidBranchName` does not need to state.
 */
export function isValidTagName(name: string): boolean {
  if (!isValidBranchName(name)) {
    return false;
  }
  return !name.endsWith('.');
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
  const trimmed = url.trim();

  // SCP-like SSH syntax (git@host:owner/repo[.git]) is not a standard URL,
  // so it must be validated separately. The `.git` suffix is optional.
  const scpLikePattern = /^[^\s@]+@[^\s:]+:[^\s]+$/;
  if (scpLikePattern.test(trimmed)) {
    return true;
  }

  // Standard URLs: only secure/known git transports. `.git` suffix is optional
  // (GitHub & co. accept URLs without it). Plain http is rejected on purpose.
  try {
    const parsed = new URL(trimmed);
    const allowedProtocols = ['https:', 'ssh:', 'git:'];
    if (!allowedProtocols.includes(parsed.protocol)) {
      return false;
    }
    return parsed.hostname.length > 0 && parsed.pathname.replace(/^\/+/, '').length > 0;
  } catch {
    return false;
  }
}

export function sanitizeInput(input: string): string {
  // Remove potential shell injection characters
  return input.replace(/[;&|`$(){}[\]<>\\]/g, '');
}

const MIN_COMMIT_SUBJECT_LENGTH = 10;

/**
 * Bookkeeping lines a CLI prints alongside a model's answer (usage stats,
 * timings, the model or session it used).
 *
 * Every pattern is anchored: an answer that merely mentions a token, a model
 * or a session is real content and must survive the filter.
 */
export const TELEMETRY_LINE_PATTERNS: RegExp[] = [
  /^\s*$/,
  /^\d+\s*(tokens?|ms|s)\b/i,
  /^(total\s+)?tokens?\s*[:=]/i,
  /\b\d+\s+tokens?\b/i,
  /^model\s*[:=]/i,
  /^session\s*[:=]/i,
  /^Time:/i,
  /^Cost:/i,
  /^Input:/i,
  /^Output:/i,
];

// Telemetry, plus the markdown scaffolding a model wraps an answer in. None of
// it can ever be part of a commit subject.
const COMMIT_NOISE_PATTERNS: RegExp[] = [
  ...TELEMETRY_LINE_PATTERNS,
  /^#/,
  /^\$/,
  /^>/,
  /^```/,
  /^[-*]\s/, // markdown bullet
  /^\d+\.\s/, // markdown ordered list
];

// Conversational openers (EN/FR/ES) that a model emits before the real answer.
// Without this, a reply like "Sure, here is your commit message:" would be
// proposed verbatim as the commit subject.
const COMMIT_PREAMBLE_PATTERN =
  /^(sure|certainly|of course|okay|ok|alright|here\b|here's|this is|i('| ha)ve|based on|voici|bien s[ûu]r|d'accord|voil[àa]|claro|por supuesto|aqu[íi]|el mensaje|le message|the commit|commit message|message de commit|mensaje de commit)/i;

// A line the model wrote *about* a commit message rather than the message itself.
const COMMIT_META_PATTERN = /\b(commit message|message de commit|mensaje de commit)\b/i;

const COMMIT_VERB_PATTERN =
  /^(add|update|fix|remove|refactor|implement|create|delete|change|improve|move|rename)/i;

function stripWrappingQuotes(line: string): string {
  return line.replace(/^["'`]|["'`]$/g, '').trim();
}

/**
 * Whether a line is usable as a commit subject on its own.
 *
 * Rejects the shapes that mean "the model is talking, not committing":
 * preambles, meta-commentary, questions, and lines that announce something
 * else (trailing colon).
 */
function isPlausibleCommitSubject(line: string): boolean {
  if (line.length < MIN_COMMIT_SUBJECT_LENGTH || line.length > MAX_COMMIT_FIRST_LINE_LENGTH) {
    return false;
  }
  if (line.endsWith(':') || line.endsWith('?')) {
    return false;
  }
  return !COMMIT_PREAMBLE_PATTERN.test(line) && !COMMIT_META_PATTERN.test(line);
}

/**
 * Extract a commit subject from raw LLM output.
 *
 * Three ordered passes, from strongest evidence to weakest: a conventional
 * commit header, a line opening with a commit verb, then any line that still
 * reads as a commit subject (which keeps non-English replies working). Returns
 * null when nothing qualifies — callers fall back to manual entry rather than
 * committing model noise.
 */
export function extractCommitMessage(text: string): string | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  const candidates = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => !COMMIT_NOISE_PATTERNS.some(pattern => pattern.test(line)));

  for (const candidate of candidates) {
    const line = stripWrappingQuotes(candidate);
    if (isConventionalCommit(line)) {
      return line.substring(0, MAX_COMMIT_FIRST_LINE_LENGTH);
    }
  }

  for (const candidate of candidates) {
    const line = stripWrappingQuotes(candidate);
    if (COMMIT_VERB_PATTERN.test(line) && isPlausibleCommitSubject(line)) {
      return line;
    }
  }

  for (const candidate of candidates) {
    const line = stripWrappingQuotes(candidate);
    if (isPlausibleCommitSubject(line)) {
      return line;
    }
  }

  return null;
}
