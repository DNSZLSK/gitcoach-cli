import Conf from 'conf';

export type EventType =
  | 'commit'
  | 'push'
  | 'pull'
  | 'branch_create'
  | 'branch_switch'
  | 'branch_delete'
  | 'error_prevented'
  | 'ai_commit_generated'
  | 'config_changed';

export interface AnalyticsEvent {
  type: EventType;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface AnalyticsData {
  events: AnalyticsEvent[];
  summary: {
    totalCommits: number;
    totalPushes: number;
    totalPulls: number;
    branchesCreated: number;
    branchesSwitched: number;
    branchesDeleted: number;
    errorsPrevented: number;
    aiCommitsGenerated: number;
    firstUsed: string;
    lastUsed: string;
  };
}

const DEFAULT_ANALYTICS: AnalyticsData = {
  events: [],
  summary: {
    totalCommits: 0,
    totalPushes: 0,
    totalPulls: 0,
    branchesCreated: 0,
    branchesSwitched: 0,
    branchesDeleted: 0,
    errorsPrevented: 0,
    aiCommitsGenerated: 0,
    firstUsed: new Date().toISOString(),
    lastUsed: new Date().toISOString()
  }
};

const analyticsStore = new Conf<AnalyticsData>({
  projectName: 'gitsense',
  configName: 'analytics',
  defaults: DEFAULT_ANALYTICS
});

class AnalyticsTracker {
  private maxEvents = 1000; // Keep last 1000 events to prevent file from growing too large

  trackEvent(type: EventType, details?: Record<string, unknown>): void {
    const event: AnalyticsEvent = {
      type,
      timestamp: new Date().toISOString(),
      details
    };

    // Add event to history
    const events = analyticsStore.get('events', []);
    events.push(event);

    // Trim events if exceeds max
    if (events.length > this.maxEvents) {
      events.splice(0, events.length - this.maxEvents);
    }

    analyticsStore.set('events', events);

    // Update summary
    this.updateSummary(type);
  }

  private updateSummary(type: EventType): void {
    const summary = analyticsStore.get('summary', DEFAULT_ANALYTICS.summary);

    switch (type) {
      case 'commit':
        summary.totalCommits++;
        break;
      case 'push':
        summary.totalPushes++;
        break;
      case 'pull':
        summary.totalPulls++;
        break;
      case 'branch_create':
        summary.branchesCreated++;
        break;
      case 'branch_switch':
        summary.branchesSwitched++;
        break;
      case 'branch_delete':
        summary.branchesDeleted++;
        break;
      case 'error_prevented':
        summary.errorsPrevented++;
        break;
      case 'ai_commit_generated':
        summary.aiCommitsGenerated++;
        break;
    }

    summary.lastUsed = new Date().toISOString();
    analyticsStore.set('summary', summary);
  }

  getSummary(): AnalyticsData['summary'] {
    return analyticsStore.get('summary', DEFAULT_ANALYTICS.summary);
  }

  getRecentEvents(limit: number = 50): AnalyticsEvent[] {
    const events = analyticsStore.get('events', []);
    return events.slice(-limit);
  }

  getEventsByType(type: EventType, limit: number = 50): AnalyticsEvent[] {
    const events = analyticsStore.get('events', []);
    return events.filter(e => e.type === type).slice(-limit);
  }

  getEventCountByType(): Record<EventType, number> {
    const events = analyticsStore.get('events', []);
    const counts: Record<string, number> = {};

    for (const event of events) {
      counts[event.type] = (counts[event.type] || 0) + 1;
    }

    return counts as Record<EventType, number>;
  }

  clearHistory(): void {
    analyticsStore.set('events', []);
  }

  reset(): void {
    analyticsStore.clear();
  }

  getDataPath(): string {
    return analyticsStore.path;
  }
}

export const tracker = new AnalyticsTracker();
export default tracker;
