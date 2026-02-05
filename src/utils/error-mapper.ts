import { t } from '../i18n/index.js';
import { logger } from './logger.js';
import { copilotService } from '../services/copilot-service.js';

interface ErrorPattern {
  patterns: RegExp[];
  key: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // Most specific patterns first
  {
    patterns: [/index\.lock/, /lock\s*file/i],
    key: 'errors.lockFileExists'
  },
  {
    patterns: [/rate\s*limit/i],
    key: 'errors.rateLimited'
  },
  {
    patterns: [/no\s*space\s*left/i, /disk\s*full/i, /enospc/i],
    key: 'errors.diskFull'
  },
  {
    patterns: [/detached\s*head/i],
    key: 'errors.detachedHead'
  },
  {
    patterns: [/non-fast-forward/i, /rejected/i],
    key: 'errors.pushRejected'
  },
  {
    patterns: [/already\s*exists/i],
    key: 'errors.alreadyExists'
  },
  {
    patterns: [/does\s*not\s*exist/i, /pathspec/i],
    key: 'errors.fileNotFound'
  },
  {
    patterns: [/conflict/i],
    key: 'errors.mergeConflict'
  },
  {
    patterns: [/could\s*not\s*resolve\s*host/i, /unable\s*to\s*access/i, /network/i, /could\s*not\s*connect/i],
    key: 'errors.networkError'
  },
  {
    patterns: [/authentication/i, /could\s*not\s*read/i],
    key: 'errors.authenticationFailed'
  },
  {
    patterns: [/permission\s*denied/i, /eacces/i],
    key: 'errors.permissionDenied'
  },
  {
    patterns: [/not\s*a\s*git\s*repository/i],
    key: 'warnings.notGitRepo'
  },
  {
    patterns: [/timeout/i, /timed?\s*out/i],
    key: 'errors.timeout'
  }
];

function cleanErrorMessage(message: string): string {
  return message
    .replace(/^error:\s*/i, '')
    .replace(/^fatal:\s*/i, '')
    .replace(/^warning:\s*/i, '')
    .trim();
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error === null || error === undefined) {
    return t('errors.unknownError');
  }
  return String(error);
}

/**
 * Maps a raw Git error to a user-friendly translated message.
 * Tests patterns from most specific to most generic,
 * falling back to the generic error message with the original cleaned text.
 */
export function mapGitError(error: unknown): string {
  const rawMessage = extractErrorMessage(error);

  logger.debug(`Raw error: ${rawMessage}`);

  const cleaned = cleanErrorMessage(rawMessage);

  for (const { patterns, key } of ERROR_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(cleaned)) {
        return t(key);
      }
    }
  }

  // Fallback: generic error with cleaned message
  return t('errors.generic', { message: cleaned });
}

/**
 * Maps a Git error with optional AI-powered contextual explanation.
 * Returns the static message immediately, enriched with Copilot explanation if available.
 */
export async function mapGitErrorWithAI(
  error: unknown,
  context?: { command?: string; branch?: string; hasUncommitted?: boolean }
): Promise<string> {
  const staticMessage = mapGitError(error);

  try {
    if (await copilotService.isAvailable()) {
      const rawMessage = extractErrorMessage(error);
      const aiResult = await copilotService.explainGitError(rawMessage, context);
      if (aiResult.success && aiResult.message) {
        return `${staticMessage}\n\n${t('copilot.aiExplanation')}:\n${aiResult.message}`;
      }
    }
  } catch {
    logger.debug('AI error explanation failed, using static message');
  }

  return staticMessage;
}
