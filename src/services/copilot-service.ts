import { executeCommand, sleep } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';
import { t } from '../i18n/index.js';

const COPILOT_TIMEOUT_MS = 30000;
const COPILOT_RETRY_DELAY_MS = 1000;
const COPILOT_MAX_RETRIES = 1;
const COPILOT_INSTALL_TIMEOUT_MS = 120000;
const MAX_DIFF_FILES = 5;
const MAX_COMMIT_MSG_LENGTH = 100;
const MIN_COMMIT_MSG_LENGTH = 10;
const MIN_LINE_LENGTH = 5;
const MAX_SUGGESTION_LENGTH = 500;

function getCopilotCommand(): string {
  return process.env.COPILOT_CLI_PATH || 'copilot';
}

export interface CopilotSuggestion {
  success: boolean;
  message: string;
  command?: string;
}

class CopilotService {
  private available: boolean | null = null;

  async isAvailable(): Promise<boolean> {
    if (this.available !== null) {
      return this.available;
    }

    try {
      // Use the new GitHub Copilot CLI (not gh copilot extension)
      const { stdout, stderr } = await executeCommand(`${getCopilotCommand()} --version`);

      // Check for version number in output (e.g., "0.0.393")
      const hasVersion = /\d+\.\d+/.test(stdout);
      const hasError = stderr.includes('not found') || stderr.includes('not recognized');

      this.available = hasVersion && !hasError;
      logger.debug('Copilot CLI availability check:', { stdout, stderr, available: this.available });
      return this.available;
    } catch (error) {
      logger.debug('Copilot CLI availability check failed:', error);
      this.available = false;
      return false;
    }
  }

  // Reset cached availability (useful for testing or after installation)
  resetAvailability(): void {
    this.available = null;
  }

  /**
   * Install GitHub Copilot CLI
   * Returns true if installation succeeded, false otherwise
   */
  async installCopilotCli(): Promise<{ success: boolean; message: string }> {
    try {
      // Install the GitHub Copilot CLI package globally
      const { stdout, stderr } = await executeCommand(
        'npm install -g @githubnext/github-copilot-cli',
        COPILOT_INSTALL_TIMEOUT_MS
      );

      logger.debug('Copilot CLI installation output:', { stdout, stderr });

      // Reset cached availability to force re-check
      this.resetAvailability();

      // Verify installation worked
      const isNowAvailable = await this.isAvailable();

      if (isNowAvailable) {
        return {
          success: true,
          message: 'GitHub Copilot CLI installed successfully'
        };
      } else {
        return {
          success: false,
          message: 'Installation completed but Copilot CLI verification failed'
        };
      }
    } catch (error) {
      logger.debug('Copilot CLI installation failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : t('errors.unknownError')
      };
    }
  }

  async generateCommitMessage(diff: string): Promise<CopilotSuggestion> {
    if (!(await this.isAvailable())) {
      return {
        success: false,
        message: 'GitHub Copilot CLI is not available'
      };
    }

    if (!diff || diff.trim().length === 0) {
      return {
        success: false,
        message: 'No changes to analyze'
      };
    }

    try {
      // Summarize the diff for the prompt (extract file names only for safety)
      const diffSummary = this.summarizeDiff(diff);

      // Build a simple prompt - keep it clean with only alphanumeric chars
      const prompt = `Generate a conventional commit message for these file changes: ${diffSummary}. Use format type: description where type is feat fix docs refactor test or chore. Reply with only the commit message.`;

      logger.debug('Copilot prompt:', prompt);

      // Use copilot CLI in non-interactive mode with silent output
      const result = await this.executeWithRetry(
        `${getCopilotCommand()} -p "${this.escapeForShell(prompt)}" -s`,
        COPILOT_TIMEOUT_MS
      );

      if (!result) {
        return { success: false, message: 'Could not generate a commit message' };
      }

      const { stdout, stderr } = result;
      logger.debug('Copilot CLI response:', { stdout: stdout.substring(0, 500), stderr });

      // Parse the response to extract the suggested commit message
      const message = this.parseCommitMessage(stdout, stderr);

      if (message) {
        return {
          success: true,
          message
        };
      }

      return {
        success: false,
        message: 'Could not generate a commit message'
      };
    } catch (error) {
      logger.debug('Copilot CLI suggestion failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : t('errors.unknownError')
      };
    }
  }

  private summarizeDiff(diff: string): string {
    const lines = diff.split('\n');
    const files: string[] = [];
    let additions = 0;
    let deletions = 0;

    for (const line of lines) {
      // Extract file names
      if (line.startsWith('diff --git')) {
        const match = line.match(/b\/(.+)$/);
        if (match) {
          files.push(match[1]);
        }
      }
      // Count additions and deletions (safer than including code content)
      else if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      }
      else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }

    // Build a safe single-line summary (no code content, just metadata)
    const parts: string[] = [];

    if (files.length > 0) {
      // Clean file names (remove special chars)
      const cleanFiles = files.slice(0, MAX_DIFF_FILES).map(f => f.replace(/[^a-zA-Z0-9._/-]/g, ''));
      parts.push(`Files: ${cleanFiles.join(', ')}`);
    }

    if (additions > 0 || deletions > 0) {
      parts.push(`${additions} additions, ${deletions} deletions`);
    }

    return parts.join('. ');
  }

  private escapeForShell(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');
  }

  async analyzeContext(
    branch: string,
    stagedFiles: string[],
    modifiedFiles: string[]
  ): Promise<CopilotSuggestion> {
    if (!(await this.isAvailable())) {
      return {
        success: false,
        message: 'GitHub Copilot CLI is not available'
      };
    }

    try {
      const context = `Branch: ${branch}. Staged files: ${stagedFiles.join(', ') || 'none'}. Modified files: ${modifiedFiles.join(', ') || 'none'}.`;
      const prompt = `Given this git state: ${context} What should the user do next? Reply with a single brief suggestion in one sentence.`;

      const { stdout, stderr } = await executeCommand(
        `${getCopilotCommand()} -p "${this.escapeForShell(prompt)}" -s`,
        COPILOT_TIMEOUT_MS
      );

      const suggestion = this.parseSuggestion(stdout, stderr);

      return {
        success: !!suggestion,
        message: suggestion || 'No suggestion available'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : t('errors.unknownError')
      };
    }
  }

  async predictProblems(
    action: string,
    currentBranch: string,
    hasUncommitted: boolean
  ): Promise<CopilotSuggestion> {
    if (!(await this.isAvailable())) {
      return {
        success: false,
        message: 'GitHub Copilot CLI is not available'
      };
    }

    try {
      const context = `Action: ${action}. Branch: ${currentBranch}. Uncommitted changes: ${hasUncommitted}.`;
      const prompt = `Will this git action cause problems? ${context} Reply briefly in one sentence.`;

      const { stdout, stderr } = await executeCommand(
        `${getCopilotCommand()} -p "${this.escapeForShell(prompt)}" -s`,
        COPILOT_TIMEOUT_MS
      );

      const prediction = this.parseSuggestion(stdout, stderr);

      return {
        success: true,
        message: prediction || 'No issues predicted'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : t('errors.unknownError')
      };
    }
  }

  async explainConcept(concept: string): Promise<CopilotSuggestion> {
    if (!(await this.isAvailable())) {
      return {
        success: false,
        message: 'GitHub Copilot CLI is not available'
      };
    }

    try {
      const prompt = `Explain this Git concept briefly for a beginner in 2-3 sentences: ${concept}`;

      const { stdout, stderr } = await executeCommand(
        `${getCopilotCommand()} -p "${this.escapeForShell(prompt)}" -s`,
        COPILOT_TIMEOUT_MS
      );

      const explanation = this.parseSuggestion(stdout, stderr);

      return {
        success: !!explanation,
        message: explanation || 'No explanation available'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : t('errors.unknownError')
      };
    }
  }

  /**
   * Ask a Git question in natural language
   */
  async askGitQuestion(question: string): Promise<CopilotSuggestion> {
    if (!(await this.isAvailable())) {
      return {
        success: false,
        message: 'GitHub Copilot CLI is not available'
      };
    }

    if (!question || question.trim().length === 0) {
      return {
        success: false,
        message: 'Please provide a question'
      };
    }

    try {
      const prompt = `You are a Git expert assistant. Answer this Git question clearly and concisely. If it involves commands, show the exact command to use.

Question: ${question}

Provide a helpful answer in 2-4 sentences. If relevant, include the Git command.`;

      const { stdout, stderr } = await executeCommand(
        `${getCopilotCommand()} -p "${this.escapeForShell(prompt)}" -s`,
        COPILOT_TIMEOUT_MS
      );

      const answer = this.parseAnswer(stdout, stderr);

      return {
        success: !!answer,
        message: answer || 'Could not get an answer'
      };
    } catch (error) {
      logger.debug('askGitQuestion failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : t('errors.unknownError')
      };
    }
  }

  /**
   * Explain a Git error and suggest solutions
   */
  async explainGitError(errorMessage: string, command?: string): Promise<CopilotSuggestion> {
    if (!(await this.isAvailable())) {
      return {
        success: false,
        message: 'GitHub Copilot CLI is not available'
      };
    }

    if (!errorMessage || errorMessage.trim().length === 0) {
      return {
        success: false,
        message: 'No error message provided'
      };
    }

    try {
      const commandContext = command ? `Command executed: ${command}\n` : '';
      const prompt = `You are a Git expert. Explain this Git error simply and provide a solution.

${commandContext}Error message: ${errorMessage}

1. Explain what this error means in simple terms (1 sentence)
2. Provide the solution or command to fix it (1-2 sentences)

Be concise and practical.`;

      const { stdout, stderr } = await executeCommand(
        `${getCopilotCommand()} -p "${this.escapeForShell(prompt)}" -s`,
        COPILOT_TIMEOUT_MS
      );

      const explanation = this.parseAnswer(stdout, stderr);

      return {
        success: !!explanation,
        message: explanation || 'Could not explain the error'
      };
    } catch (error) {
      logger.debug('explainGitError failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : t('errors.unknownError')
      };
    }
  }

  private async executeWithRetry(
    command: string,
    timeout: number
  ): Promise<{ stdout: string; stderr: string } | null> {
    for (let attempt = 0; attempt <= COPILOT_MAX_RETRIES; attempt++) {
      try {
        return await executeCommand(command, timeout);
      } catch (error) {
        logger.debug(`Copilot attempt ${attempt + 1} failed:`, error);
        if (attempt < COPILOT_MAX_RETRIES) {
          await sleep(COPILOT_RETRY_DELAY_MS);
        }
      }
    }
    return null;
  }

  private parseAnswer(output: string, stderr?: string): string | null {
    const combined = `${output}\n${stderr || ''}`.trim();
    const lines = combined.split('\n');

    // Patterns to filter out (CLI stats)
    const filterPatterns = [
      /^\s*$/,
      /tokens?/i,
      /model/i,
      /session/i,
      /^\d+\s*(tokens?|ms|s)\b/i,
      /^Time:/i,
      /^Cost:/i,
      /^Input:/i,
      /^Output:/i
    ];

    // Collect all meaningful lines
    const meaningfulLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (filterPatterns.some(pattern => pattern.test(trimmed))) {
        continue;
      }

      if (trimmed.length >= MIN_LINE_LENGTH) {
        meaningfulLines.push(trimmed);
      }
    }

    if (meaningfulLines.length > 0) {
      return meaningfulLines.join('\n');
    }

    return null;
  }

  private parseCommitMessage(output: string, stderr?: string): string | null {
    // Combine stdout and stderr
    const combined = `${output}\n${stderr || ''}`.trim();
    const lines = combined.split('\n');

    // Patterns to filter out (CLI noise, stats, etc.)
    const filterPatterns = [
      /^\s*$/,
      /^#/,
      /^\$/,
      /^>/,
      /tokens?/i,
      /model/i,
      /session/i,
      /^\d+\s*(tokens?|ms|s)\b/i,
      /^Time:/i,
      /^Cost:/i,
      /^Input:/i,
      /^Output:/i
    ];

    // First pass: look for conventional commit pattern
    for (const line of lines) {
      const trimmed = line.trim();

      // Skip filtered patterns
      if (filterPatterns.some(pattern => pattern.test(trimmed))) {
        continue;
      }

      // Match conventional commit format
      if (/^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!?:\s*.+/i.test(trimmed)) {
        // Clean up the message (remove quotes, backticks)
        return trimmed.replace(/^["'`]|["'`]$/g, '').substring(0, MAX_COMMIT_MSG_LENGTH);
      }
    }

    // Second pass: look for any meaningful commit-like message
    for (const line of lines) {
      const trimmed = line.trim();

      // Skip filtered patterns
      if (filterPatterns.some(pattern => pattern.test(trimmed))) {
        continue;
      }

      // Accept lines that look like commit messages (start with verb, reasonable length)
      if (trimmed.length >= MIN_COMMIT_MSG_LENGTH && trimmed.length <= MAX_COMMIT_MSG_LENGTH) {
        // Check if it starts with a common commit verb
        if (/^(add|update|fix|remove|refactor|implement|create|delete|change|improve|move|rename)/i.test(trimmed)) {
          return trimmed.replace(/^["'`]|["'`]$/g, '');
        }
      }
    }

    // Third pass: return first clean line as fallback
    for (const line of lines) {
      const trimmed = line.trim();

      if (filterPatterns.some(pattern => pattern.test(trimmed))) {
        continue;
      }

      if (trimmed.length >= MIN_LINE_LENGTH && trimmed.length <= MAX_COMMIT_MSG_LENGTH) {
        return trimmed.replace(/^["'`]|["'`]$/g, '');
      }
    }

    return null;
  }

  private parseSuggestion(output: string, stderr?: string): string | null {
    const combined = `${output}\n${stderr || ''}`.trim();
    const lines = combined.split('\n');

    // Patterns to filter out
    const filterPatterns = [
      /^\s*$/,
      /^#/,
      /^\$/,
      /^>/,
      /tokens?/i,
      /model/i,
      /session/i,
      /^\d+\s*(tokens?|ms|s)\b/i,
      /^Time:/i,
      /^Cost:/i
    ];

    // Return meaningful content, filtering out CLI stats
    for (const line of lines) {
      const trimmed = line.trim();

      if (filterPatterns.some(pattern => pattern.test(trimmed))) {
        continue;
      }

      if (trimmed.length >= MIN_COMMIT_MSG_LENGTH && trimmed.length <= MAX_SUGGESTION_LENGTH) {
        return trimmed;
      }
    }

    return null;
  }
}

export const copilotService = new CopilotService();
export default copilotService;
