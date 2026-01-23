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
      // Truncate diff if too long to avoid command line limits
      const truncatedDiff = diff.length > 3000 ? diff.substring(0, 3000) + '...' : diff;

      // Escape special characters for shell
      const escapedDiff = truncatedDiff
        .replace(/"/g, '\\"')
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$')
        .replace(/\n/g, ' ');

      const prompt = `Generate a concise conventional commit message (type: description format) for these changes: ${escapedDiff}`;

      const { stdout, stderr } = await executeCommand(
        `gh copilot suggest -t shell "${prompt}"`
      );

      if (stderr && stderr.includes('error')) {
        logger.debug('Copilot error:', stderr);
        return {
          success: false,
          message: 'Copilot returned an error'
        };
      }

      // Parse the response to extract the suggested commit message
      const message = this.parseCommitMessage(stdout);

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
      const prompt = `Given this git state: ${context} What should the user do next? Give a brief suggestion.`;

      const { stdout, stderr } = await executeCommand(
        `gh copilot suggest -t shell "${prompt}"`
      );

      if (stderr && stderr.includes('error')) {
        return {
          success: false,
          message: 'Copilot returned an error'
        };
      }

      const suggestion = this.parseSuggestion(stdout);

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
      const prompt = `Will this action cause problems? ${context} Answer briefly.`;

      const { stdout } = await executeCommand(
        `gh copilot suggest -t shell "${prompt}"`
      );

      const prediction = this.parseSuggestion(stdout);

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

  private parseCommitMessage(output: string): string | null {
    // Try to extract a commit message from Copilot output
    // Copilot may return the message in various formats

    const lines = output.trim().split('\n');

    // Look for conventional commit pattern
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!?:\s*.+/i.test(trimmed)) {
        return trimmed;
      }
    }

    // If no conventional commit found, return the first non-empty line
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.length > 3) {
        return trimmed;
      }
    }

    return null;
  }

  private parseSuggestion(output: string): string | null {
    const lines = output.trim().split('\n');

    // Return meaningful content, filtering out command prompts
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('$') && !trimmed.startsWith('>')) {
        return trimmed;
      }
    }

    return null;
  }
}

export const copilotService = new CopilotService();
export default copilotService;
