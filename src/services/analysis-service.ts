import { gitService, GitStatus } from './git-service.js';
import { copilotService } from './copilot-service.js';
import { t } from '../i18n/index.js';
import { userConfig } from '../config/user-config.js';

export type SuggestionPriority = 'high' | 'medium' | 'low';

export interface Suggestion {
  action: string;
  description: string;
  priority: SuggestionPriority;
  command?: string;
}

export interface StateAnalysis {
  status: GitStatus;
  suggestions: Suggestion[];
  tip?: string;
}

class AnalysisService {
  async analyzeWorkingState(): Promise<StateAnalysis> {
    const status = await gitService.getStatus();
    const suggestions: Suggestion[] = [];

    // Generate suggestions based on current state
    if (status.untracked.length > 0) {
      suggestions.push({
        action: t('commands.add.title'),
        description: t('analysis.untrackedFiles', { count: status.untracked.length }),
        priority: 'medium',
        command: 'add'
      });
    }

    if (status.modified.length > 0) {
      suggestions.push({
        action: t('commands.add.title'),
        description: t('analysis.modifiedNotStaged', { count: status.modified.length }),
        priority: 'high',
        command: 'add'
      });
    }

    if (status.staged.length > 0) {
      suggestions.push({
        action: t('commands.commit.title'),
        description: t('analysis.readyToCommit', { count: status.staged.length }),
        priority: 'high',
        command: 'commit'
      });
    }

    if (status.ahead > 0 && status.staged.length === 0 && status.modified.length === 0) {
      suggestions.push({
        action: t('commands.push.title'),
        description: t('analysis.aheadOfRemote', { count: status.ahead }),
        priority: 'medium',
        command: 'push'
      });
    }

    if (status.behind > 0) {
      suggestions.push({
        action: t('commands.pull.title'),
        description: t('analysis.behindRemote', { count: status.behind }),
        priority: 'high',
        command: 'pull'
      });
    }

    if (status.isClean && status.ahead === 0) {
      suggestions.push({
        action: t('analysis.startCoding'),
        description: t('analysis.cleanAndUpToDate'),
        priority: 'low'
      });
    }

    // Get a contextual tip based on experience level
    const tip = this.getTip(status);

    return {
      status,
      suggestions,
      tip
    };
  }

  async suggestNextAction(): Promise<Suggestion | null> {
    const analysis = await this.analyzeWorkingState();

    // Sort by priority and return highest
    const sorted = analysis.suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return sorted[0] || null;
  }

  async getAISuggestion(): Promise<string | null> {
    const status = await gitService.getStatus();

    const result = await copilotService.analyzeContext(
      status.current || 'unknown',
      status.staged,
      status.modified
    );

    if (result.success) {
      return result.message;
    }

    return null;
  }

  getTip(status: GitStatus): string | undefined {
    const level = userConfig.getExperienceLevel();

    if (level === 'expert') {
      return undefined; // No tips for experts
    }

    // Contextual tips based on state
    if (level === 'beginner') {
      if (status.modified.length > 0 && status.staged.length === 0) {
        return t('tips.beginner.add');
      }
      if (status.staged.length > 0) {
        return t('tips.beginner.commit');
      }
      if (status.ahead > 0) {
        return t('tips.beginner.push');
      }
      if (status.behind > 0) {
        return t('tips.beginner.pull');
      }
      if (status.isClean) {
        return t('tips.beginner.status');
      }
    }

    if (level === 'intermediate') {
      if (status.staged.length > 0) {
        return t('tips.intermediate.commit');
      }
    }

    return undefined;
  }

  calculateEstimatedTimeSaved(): string {
    const errorsPrevented = userConfig.getErrorsPreventedCount();
    const aiCommits = userConfig.getAiCommitsGenerated();

    // Rough estimates:
    // - Each prevented error saves ~5 minutes of debugging
    // - Each AI commit message saves ~1 minute
    const minutesSaved = (errorsPrevented * 5) + (aiCommits * 1);

    if (minutesSaved < 60) {
      return `${minutesSaved} minutes`;
    }

    const hours = Math.floor(minutesSaved / 60);
    const minutes = minutesSaved % 60;

    if (minutes === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }

    return `${hours}h ${minutes}m`;
  }

  async getQuickStatus(): Promise<string> {
    const status = await gitService.getStatus();
    const parts: string[] = [];

    if (status.current) {
      parts.push(`[${status.current}]`);
    }

    if (status.staged.length > 0) {
      parts.push(`+${status.staged.length}`);
    }

    if (status.modified.length > 0) {
      parts.push(`~${status.modified.length}`);
    }

    if (status.untracked.length > 0) {
      parts.push(`?${status.untracked.length}`);
    }

    if (status.ahead > 0) {
      parts.push(`↑${status.ahead}`);
    }

    if (status.behind > 0) {
      parts.push(`↓${status.behind}`);
    }

    if (status.isClean && status.ahead === 0 && status.behind === 0) {
      parts.push('✓');
    }

    return parts.join(' ');
  }
}

export const analysisService = new AnalysisService();
export default analysisService;
