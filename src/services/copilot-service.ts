import { executeCommand } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';

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
      const { stdout, stderr } = await executeCommand('gh copilot --version');
      // Check if stderr contains error indicators
      if (stderr.includes('unknown command') || stderr.includes('not found')) {
        this.available = false;
        return false;
      }
      // Check if stdout contains version info (e.g., "version 1.2.0" or "gh copilot version")
      const hasVersion = stdout.toLowerCase().includes('version') || /\d+\.\d+/.test(stdout);
      this.available = hasVersion || (!stderr.includes('error'));
      logger.debug('Copilot availability check:', { stdout, stderr, available: this.available });
      return this.available;
    } catch (error) {
      logger.debug('Copilot availability check failed:', error);
      this.available = false;
      return false;
    }
  }

  // Reset cached availability (useful for testing)
  resetAvailability(): void {
    this.available = null;
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
      // Summarize the diff for the prompt (extract file names and key changes)
      const diffSummary = this.summarizeDiff(diff);

      // Use gh copilot explain with a specific prompt for commit message generation
      const prompt = `Generate a single-line conventional commit message (format: type: description) for these git changes. Types: feat, fix, docs, style, refactor, test, chore. Changes: ${diffSummary}. Reply with ONLY the commit message, nothing else.`;

      const { stdout, stderr } = await executeCommand(
        `gh copilot explain "${this.escapeForShell(prompt)}"`
      );

      logger.debug('Copilot response:', { stdout, stderr });

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
      logger.debug('Copilot suggestion failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private summarizeDiff(diff: string): string {
    const lines = diff.split('\n');
    const files: string[] = [];
    const changes: string[] = [];

    for (const line of lines) {
      // Extract file names
      if (line.startsWith('diff --git')) {
        const match = line.match(/b\/(.+)$/);
        if (match) {
          files.push(match[1]);
        }
      }
      // Extract added lines (limit to avoid command line overflow)
      else if (line.startsWith('+') && !line.startsWith('+++') && changes.length < 10) {
        const content = line.substring(1).trim();
        if (content.length > 0 && content.length < 100) {
          changes.push(content);
        }
      }
    }

    const filesSummary = files.length > 0 ? `Files: ${files.slice(0, 5).join(', ')}` : '';
    const changesSummary = changes.length > 0 ? `Key changes: ${changes.slice(0, 5).join('; ')}` : '';

    return `${filesSummary}. ${changesSummary}`.substring(0, 500);
  }

  private escapeForShell(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$')
      .replace(/\n/g, ' ')
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
      const prompt = `Given this git state: ${context} What should the user do next? Reply with a single brief suggestion.`;

      const { stdout, stderr } = await executeCommand(
        `gh copilot explain "${this.escapeForShell(prompt)}"`
      );

      const suggestion = this.parseSuggestion(stdout, stderr);

      return {
        success: !!suggestion,
        message: suggestion || 'No suggestion available'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
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
        `gh copilot explain "${this.escapeForShell(prompt)}"`
      );

      const prediction = this.parseSuggestion(stdout, stderr);

      return {
        success: true,
        message: prediction || 'No issues predicted'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
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
      const prompt = `Explain this Git concept briefly for a beginner: ${concept}`;

      const { stdout, stderr } = await executeCommand(
        `gh copilot explain "${prompt}"`
      );

      if (stderr && stderr.includes('error')) {
        return {
          success: false,
          message: 'Copilot returned an error'
        };
      }

      return {
        success: true,
        message: stdout.trim() || 'No explanation available'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private parseCommitMessage(output: string, stderr?: string): string | null {
    // Combine stdout and stderr, as Copilot may output to either
    const combined = `${output}\n${stderr || ''}`.trim();
    const lines = combined.split('\n');

    // Patterns to filter out (GitHub CLI warnings, prompts, etc.)
    const filterPatterns = [
      /deprecated/i,
      /extension/i,
      /warning/i,
      /error/i,
      /^\s*$/,
      /^#/,
      /^\$/,
      /^>/,
      /welcome/i,
      /copilot/i,
      /github/i,
      /authenticate/i,
      /^\d+\./  // Numbered lists
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
        return trimmed.replace(/^["'`]|["'`]$/g, '');
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
      if (trimmed.length >= 10 && trimmed.length <= 100) {
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

      if (trimmed.length >= 5 && trimmed.length <= 100) {
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
      /deprecated/i,
      /extension/i,
      /warning/i,
      /error/i,
      /^\s*$/,
      /^#/,
      /^\$/,
      /^>/,
      /welcome/i,
      /copilot/i,
      /github/i,
      /authenticate/i
    ];

    // Return meaningful content, filtering out CLI messages
    for (const line of lines) {
      const trimmed = line.trim();

      if (filterPatterns.some(pattern => pattern.test(trimmed))) {
        continue;
      }

      if (trimmed.length >= 10 && trimmed.length <= 200) {
        return trimmed;
      }
    }

    return null;
  }
}

export const copilotService = new CopilotService();
export default copilotService;
