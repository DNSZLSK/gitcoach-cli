import type { Mocked } from 'vitest';
// Mock i18n - must be before imports
vi.mock('../../src/i18n/index.js', () => ({
  initI18n: vi.fn().mockResolvedValue(undefined),
  t: (key: string, params?: Record<string, unknown>) => {
    if (params) {
      let result = key;
      for (const [k, v] of Object.entries(params)) {
        result += `:${k}=${v}`;
      }
      return result;
    }
    return key;
  },
  changeLanguage: vi.fn()
}));

// Mock logger
vi.mock('../../src/utils/logger.js', async () => (await import('../helpers/module-mocks.js')).loggerMock());

// Mock user config
vi.mock('../../src/config/user-config.js', () => ({
  userConfig: {
    getTotalCommits: vi.fn().mockReturnValue(0),
    getErrorsPreventedCount: vi.fn().mockReturnValue(0),
    getAiCommitsGenerated: vi.fn().mockReturnValue(0),
    getTheme: vi.fn().mockReturnValue('colored')
  }
}));

// Mock analysis service
vi.mock('../../src/services/analysis-service.js', () => ({
  analysisService: {
    calculateEstimatedTimeSaved: vi.fn().mockReturnValue('0 minutes')
  }
}));

// Mock theme
vi.mock('../../src/ui/themes/index.js', async () => (await import('../helpers/module-mocks.js')).themeMock());

// Mock UI components
vi.mock('../../src/ui/components/box.js', async () => (await import('../helpers/module-mocks.js')).boxMock());

vi.mock('../../src/ui/components/table.js', () => ({
  statsTable: (stats: Array<{ label: string; value: string | number }>) =>
    stats.map(s => `${s.label}: ${s.value}`).join('\n')
}));

import Stats from '../../src/commands/stats.js';
import { userConfig } from '../../src/config/user-config.js';
import { analysisService } from '../../src/services/analysis-service.js';
import { logger } from '../../src/utils/logger.js';

const mockUserConfig = userConfig as Mocked<typeof userConfig>;
const mockAnalysisService = analysisService as Mocked<typeof analysisService>;
const mockLogger = logger as Mocked<typeof logger>;

describe('Stats Command', () => {
  let statsCommand: Stats;

  beforeEach(() => {
    vi.clearAllMocks();
    statsCommand = new Stats([], {} as never);
  });

  it('should show no data message when all counters are zero', async () => {
    mockUserConfig.getTotalCommits.mockReturnValue(0);
    mockUserConfig.getErrorsPreventedCount.mockReturnValue(0);
    mockUserConfig.getAiCommitsGenerated.mockReturnValue(0);

    await statsCommand.run();

    // Should display noData message
    const rawCalls = mockLogger.raw.mock.calls.map(c => c[0]);
    const hasNoData = rawCalls.some((call: string) => call.includes('stats.noData'));
    expect(hasNoData).toBe(true);
  });

  it('should display stats table when data exists', async () => {
    mockUserConfig.getTotalCommits.mockReturnValue(10);
    mockUserConfig.getErrorsPreventedCount.mockReturnValue(3);
    mockUserConfig.getAiCommitsGenerated.mockReturnValue(5);
    mockAnalysisService.calculateEstimatedTimeSaved.mockReturnValue('20 minutes');

    await statsCommand.run();

    // Should call raw with stats content
    expect(mockLogger.raw).toHaveBeenCalled();

    // Should not show noData message
    const rawCalls = mockLogger.raw.mock.calls.map(c => c[0]);
    const hasNoData = rawCalls.some((call: string) => call.includes('stats.noData'));
    expect(hasNoData).toBe(false);
  });

  it('should show AI percentage when commits exist', async () => {
    mockUserConfig.getTotalCommits.mockReturnValue(10);
    mockUserConfig.getErrorsPreventedCount.mockReturnValue(0);
    mockUserConfig.getAiCommitsGenerated.mockReturnValue(5);
    mockAnalysisService.calculateEstimatedTimeSaved.mockReturnValue('5 minutes');

    await statsCommand.run();

    const rawCalls = mockLogger.raw.mock.calls.map(c => c[0]);
    const hasAiPercentage = rawCalls.some((call: string) =>
      call.includes('stats.aiPercentage') && call.includes('50')
    );
    expect(hasAiPercentage).toBe(true);
  });

  it('should show mistakes avoided message when errors were prevented', async () => {
    mockUserConfig.getTotalCommits.mockReturnValue(5);
    mockUserConfig.getErrorsPreventedCount.mockReturnValue(7);
    mockUserConfig.getAiCommitsGenerated.mockReturnValue(0);
    mockAnalysisService.calculateEstimatedTimeSaved.mockReturnValue('35 minutes');

    await statsCommand.run();

    const rawCalls = mockLogger.raw.mock.calls.map(c => c[0]);
    const hasMistakes = rawCalls.some((call: string) =>
      call.includes('stats.mistakesAvoided') && call.includes('7')
    );
    expect(hasMistakes).toBe(true);
  });

  it('should not show AI percentage when no commits', async () => {
    mockUserConfig.getTotalCommits.mockReturnValue(0);
    mockUserConfig.getErrorsPreventedCount.mockReturnValue(1);
    mockUserConfig.getAiCommitsGenerated.mockReturnValue(0);
    mockAnalysisService.calculateEstimatedTimeSaved.mockReturnValue('5 minutes');

    await statsCommand.run();

    // With totalCommits=0 but errorsPrevented=1, it shows stats but no AI percentage
    const rawCalls = mockLogger.raw.mock.calls.map(c => c[0]);
    const hasAiPercentage = rawCalls.some((call: string) =>
      call.includes('stats.aiPercentage')
    );
    expect(hasAiPercentage).toBe(false);
  });

  it('should call calculateEstimatedTimeSaved', async () => {
    mockUserConfig.getTotalCommits.mockReturnValue(5);
    mockUserConfig.getErrorsPreventedCount.mockReturnValue(2);
    mockUserConfig.getAiCommitsGenerated.mockReturnValue(1);
    mockAnalysisService.calculateEstimatedTimeSaved.mockReturnValue('15 minutes');

    await statsCommand.run();

    expect(mockAnalysisService.calculateEstimatedTimeSaved).toHaveBeenCalled();
  });
});
