import { tracker, AnalyticsEvent } from './tracker.js';

export interface UsageStats {
  totalOperations: number;
  mostUsedOperation: string;
  averageOperationsPerDay: number;
  daysActive: number;
  streakDays: number;
  peakHour: number;
  errorPreventionRate: number;
  aiAssistanceRate: number;
}

export interface TimeStats {
  estimatedTimeSaved: number; // in minutes
  timeByOperation: Record<string, number>;
}

class StatsCalculator {
  calculateUsageStats(): UsageStats {
    const summary = tracker.getSummary();
    const events = tracker.getRecentEvents(1000);

    const totalOperations =
      summary.totalCommits +
      summary.totalPushes +
      summary.totalPulls +
      summary.branchesCreated +
      summary.branchesSwitched;

    // Calculate most used operation
    const operationCounts = {
      commits: summary.totalCommits,
      pushes: summary.totalPushes,
      pulls: summary.totalPulls,
      branches: summary.branchesCreated + summary.branchesSwitched
    };

    const mostUsedOperation = Object.entries(operationCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'none';

    // Calculate days active
    const firstUsed = new Date(summary.firstUsed);
    const lastUsed = new Date(summary.lastUsed);
    const daysActive = Math.max(1, Math.ceil((lastUsed.getTime() - firstUsed.getTime()) / (1000 * 60 * 60 * 24)));

    // Average operations per day
    const averageOperationsPerDay = totalOperations / daysActive;

    // Calculate streak (consecutive days)
    const streakDays = this.calculateStreak(events);

    // Peak hour analysis
    const peakHour = this.calculatePeakHour(events);

    // Error prevention rate (errors prevented vs total operations)
    const errorPreventionRate = totalOperations > 0
      ? (summary.errorsPrevented / totalOperations) * 100
      : 0;

    // AI assistance rate
    const aiAssistanceRate = summary.totalCommits > 0
      ? (summary.aiCommitsGenerated / summary.totalCommits) * 100
      : 0;

    return {
      totalOperations,
      mostUsedOperation,
      averageOperationsPerDay: Math.round(averageOperationsPerDay * 10) / 10,
      daysActive,
      streakDays,
      peakHour,
      errorPreventionRate: Math.round(errorPreventionRate),
      aiAssistanceRate: Math.round(aiAssistanceRate)
    };
  }

  calculateTimeStats(): TimeStats {
    const summary = tracker.getSummary();

    // Estimated time saved calculations (in minutes):
    // - Each error prevented: ~5 minutes (debugging time saved)
    // - Each AI commit message: ~1 minute (thinking time saved)
    // - Each branch operation: ~0.5 minutes (navigation time saved)

    const timeSavedFromErrors = summary.errorsPrevented * 5;
    const timeSavedFromAI = summary.aiCommitsGenerated * 1;
    const timeSavedFromBranches = (summary.branchesCreated + summary.branchesSwitched) * 0.5;

    const estimatedTimeSaved = timeSavedFromErrors + timeSavedFromAI + timeSavedFromBranches;

    return {
      estimatedTimeSaved: Math.round(estimatedTimeSaved),
      timeByOperation: {
        errorPrevention: timeSavedFromErrors,
        aiAssistance: timeSavedFromAI,
        branchManagement: timeSavedFromBranches
      }
    };
  }

  private calculateStreak(events: AnalyticsEvent[]): number {
    if (events.length === 0) return 0;

    // Group events by day
    const daySet = new Set<string>();
    for (const event of events) {
      const day = event.timestamp.substring(0, 10); // YYYY-MM-DD
      daySet.add(day);
    }

    const days = Array.from(daySet).sort().reverse();
    if (days.length === 0) return 0;

    let streak = 1;
    const today = new Date().toISOString().substring(0, 10);

    // Check if used today or yesterday
    if (days[0] !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);
      if (days[0] !== yesterday) {
        return 0; // Streak broken
      }
    }

    // Count consecutive days
    for (let i = 1; i < days.length; i++) {
      const prevDate = new Date(days[i - 1]);
      const currDate = new Date(days[i]);
      const diffDays = (prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  private calculatePeakHour(events: AnalyticsEvent[]): number {
    if (events.length === 0) return 12; // Default to noon

    const hourCounts: number[] = new Array(24).fill(0);

    for (const event of events) {
      const hour = new Date(event.timestamp).getHours();
      hourCounts[hour]++;
    }

    let maxCount = 0;
    let peakHour = 12;

    for (let i = 0; i < 24; i++) {
      if (hourCounts[i] > maxCount) {
        maxCount = hourCounts[i];
        peakHour = i;
      }
    }

    return peakHour;
  }

  formatTimeSaved(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }

    return `${hours}h ${remainingMinutes}m`;
  }
}

export const statsCalculator = new StatsCalculator();
export default statsCalculator;
