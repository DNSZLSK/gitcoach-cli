import { analysisService } from '../../src/services/analysis-service.js';

// Mock i18n
jest.mock('../../src/i18n/index.js', () => ({
  t: (key: string, params?: Record<string, unknown>) => {
    if (params) {
      let result = key;
      for (const [k, v] of Object.entries(params)) {
        result += `:${k}=${v}`;
      }
      return result;
    }
    return key;
  }
}));

// Mock logger
jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    raw: jest.fn(),
    command: jest.fn(),
    success: jest.fn()
  }
}));

// Mock user config
jest.mock('../../src/config/user-config.js', () => ({
  userConfig: {
    getExperienceLevel: jest.fn().mockReturnValue('beginner'),
    getErrorsPreventedCount: jest.fn().mockReturnValue(0),
    getAiCommitsGenerated: jest.fn().mockReturnValue(0)
  }
}));

// Mock copilot service
jest.mock('../../src/services/copilot-service.js', () => ({
  copilotService: {
    analyzeContext: jest.fn().mockResolvedValue({ success: false, message: '' })
  }
}));

// Mock git service
jest.mock('../../src/services/git-service.js', () => ({
  gitService: {
    getStatus: jest.fn()
  }
}));

import { gitService } from '../../src/services/git-service.js';
import { userConfig } from '../../src/config/user-config.js';
const mockGitService = gitService as jest.Mocked<typeof gitService>;
const mockUserConfig = userConfig as jest.Mocked<typeof userConfig>;

describe('AnalysisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserConfig.getExperienceLevel.mockReturnValue('beginner');
    mockUserConfig.getErrorsPreventedCount.mockReturnValue(0);
    mockUserConfig.getAiCommitsGenerated.mockReturnValue(0);
  });

  describe('analyzeWorkingState', () => {
    it('should suggest adding untracked files', async () => {
      mockGitService.getStatus.mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        staged: [],
        modified: [],
        untracked: ['newfile.ts'],
        ahead: 0,
        behind: 0,
        isClean: false,
        deleted: []
      });

      const result = await analysisService.analyzeWorkingState();

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].command).toBe('add');
      expect(result.suggestions[0].priority).toBe('medium');
      expect(result.suggestions[0].description).toContain('1');
    });

    it('should suggest staging modified files with high priority', async () => {
      mockGitService.getStatus.mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        staged: [],
        modified: ['file1.ts', 'file2.ts'],
        untracked: [],
        ahead: 0,
        behind: 0,
        isClean: false,
        deleted: []
      });

      const result = await analysisService.analyzeWorkingState();

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].command).toBe('add');
      expect(result.suggestions[0].priority).toBe('high');
      expect(result.suggestions[0].description).toContain('2');
    });

    it('should suggest committing staged files', async () => {
      mockGitService.getStatus.mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        staged: ['file1.ts'],
        modified: [],
        untracked: [],
        ahead: 0,
        behind: 0,
        isClean: false,
        deleted: []
      });

      const result = await analysisService.analyzeWorkingState();

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].command).toBe('commit');
      expect(result.suggestions[0].priority).toBe('high');
    });

    it('should suggest pushing when ahead of remote', async () => {
      mockGitService.getStatus.mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        staged: [],
        modified: [],
        untracked: [],
        ahead: 3,
        behind: 0,
        isClean: true,
        deleted: []
      });

      const result = await analysisService.analyzeWorkingState();

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].command).toBe('push');
      expect(result.suggestions[0].description).toContain('3');
    });

    it('should suggest pulling when behind remote', async () => {
      mockGitService.getStatus.mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        staged: [],
        modified: [],
        untracked: [],
        ahead: 0,
        behind: 2,
        isClean: true,
        deleted: []
      });

      const result = await analysisService.analyzeWorkingState();

      const pullSuggestion = result.suggestions.find(s => s.command === 'pull');
      expect(pullSuggestion).toBeDefined();
      expect(pullSuggestion!.priority).toBe('high');
    });

    it('should suggest start coding when clean and up to date', async () => {
      mockGitService.getStatus.mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        staged: [],
        modified: [],
        untracked: [],
        ahead: 0,
        behind: 0,
        isClean: true,
        deleted: []
      });

      const result = await analysisService.analyzeWorkingState();

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].priority).toBe('low');
    });

    it('should return multiple suggestions for complex states', async () => {
      mockGitService.getStatus.mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        staged: ['staged.ts'],
        modified: ['modified.ts'],
        untracked: ['new.ts'],
        ahead: 0,
        behind: 1,
        isClean: false,
        deleted: []
      });

      const result = await analysisService.analyzeWorkingState();

      // Should have 4 suggestions: untracked, modified, staged, behind
      expect(result.suggestions.length).toBeGreaterThanOrEqual(4);
    });

    it('should include a tip for beginners', async () => {
      mockUserConfig.getExperienceLevel.mockReturnValue('beginner');
      mockGitService.getStatus.mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        staged: [],
        modified: ['file.ts'],
        untracked: [],
        ahead: 0,
        behind: 0,
        isClean: false,
        deleted: []
      });

      const result = await analysisService.analyzeWorkingState();

      expect(result.tip).toBeDefined();
    });

    it('should not include tips for experts', async () => {
      mockUserConfig.getExperienceLevel.mockReturnValue('expert');
      mockGitService.getStatus.mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        staged: [],
        modified: ['file.ts'],
        untracked: [],
        ahead: 0,
        behind: 0,
        isClean: false,
        deleted: []
      });

      const result = await analysisService.analyzeWorkingState();

      expect(result.tip).toBeUndefined();
    });
  });

  describe('suggestNextAction', () => {
    it('should return the highest priority suggestion', async () => {
      mockGitService.getStatus.mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        staged: ['file.ts'],
        modified: [],
        untracked: ['new.ts'],
        ahead: 0,
        behind: 0,
        isClean: false,
        deleted: []
      });

      const result = await analysisService.suggestNextAction();

      expect(result).not.toBeNull();
      expect(result!.priority).toBe('high');
    });

    it('should return null when no suggestions', async () => {
      mockGitService.getStatus.mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        staged: [],
        modified: [],
        untracked: [],
        ahead: 0,
        behind: 0,
        isClean: true,
        deleted: []
      });

      const result = await analysisService.suggestNextAction();

      // When clean, there's a low-priority "start coding" suggestion
      expect(result).not.toBeNull();
      expect(result!.priority).toBe('low');
    });
  });

  describe('getTip', () => {
    it('should return add tip for beginners with modified files', () => {
      mockUserConfig.getExperienceLevel.mockReturnValue('beginner');

      const tip = analysisService.getTip({
        current: 'main',
        tracking: 'origin/main',
        staged: [],
        modified: ['file.ts'],
        untracked: [],
        ahead: 0,
        behind: 0,
        isClean: false,
        deleted: []
      });

      expect(tip).toBeDefined();
      expect(tip).toContain('tips.beginner.add');
    });

    it('should return commit tip for beginners with staged files', () => {
      mockUserConfig.getExperienceLevel.mockReturnValue('beginner');

      const tip = analysisService.getTip({
        current: 'main',
        tracking: 'origin/main',
        staged: ['file.ts'],
        modified: [],
        untracked: [],
        ahead: 0,
        behind: 0,
        isClean: false,
        deleted: []
      });

      expect(tip).toContain('tips.beginner.commit');
    });

    it('should return push tip for beginners ahead of remote', () => {
      mockUserConfig.getExperienceLevel.mockReturnValue('beginner');

      const tip = analysisService.getTip({
        current: 'main',
        tracking: 'origin/main',
        staged: [],
        modified: [],
        untracked: [],
        ahead: 2,
        behind: 0,
        isClean: true,
        deleted: []
      });

      expect(tip).toContain('tips.beginner.push');
    });

    it('should return pull tip for beginners behind remote', () => {
      mockUserConfig.getExperienceLevel.mockReturnValue('beginner');

      const tip = analysisService.getTip({
        current: 'main',
        tracking: 'origin/main',
        staged: [],
        modified: [],
        untracked: [],
        ahead: 0,
        behind: 3,
        isClean: true,
        deleted: []
      });

      expect(tip).toContain('tips.beginner.pull');
    });

    it('should return status tip for beginners with clean state', () => {
      mockUserConfig.getExperienceLevel.mockReturnValue('beginner');

      const tip = analysisService.getTip({
        current: 'main',
        tracking: 'origin/main',
        staged: [],
        modified: [],
        untracked: [],
        ahead: 0,
        behind: 0,
        isClean: true,
        deleted: []
      });

      expect(tip).toContain('tips.beginner.status');
    });

    it('should return commit tip for intermediate with staged files', () => {
      mockUserConfig.getExperienceLevel.mockReturnValue('intermediate');

      const tip = analysisService.getTip({
        current: 'main',
        tracking: 'origin/main',
        staged: ['file.ts'],
        modified: [],
        untracked: [],
        ahead: 0,
        behind: 0,
        isClean: false,
        deleted: []
      });

      expect(tip).toContain('tips.intermediate.commit');
    });

    it('should return undefined for experts', () => {
      mockUserConfig.getExperienceLevel.mockReturnValue('expert');

      const tip = analysisService.getTip({
        current: 'main',
        tracking: 'origin/main',
        staged: ['file.ts'],
        modified: [],
        untracked: [],
        ahead: 0,
        behind: 0,
        isClean: false,
        deleted: []
      });

      expect(tip).toBeUndefined();
    });
  });

  describe('calculateEstimatedTimeSaved', () => {
    it('should return 0 minutes when no errors or AI commits', () => {
      mockUserConfig.getErrorsPreventedCount.mockReturnValue(0);
      mockUserConfig.getAiCommitsGenerated.mockReturnValue(0);

      const result = analysisService.calculateEstimatedTimeSaved();

      expect(result).toBe('0 minutes');
    });

    it('should calculate time from errors prevented', () => {
      mockUserConfig.getErrorsPreventedCount.mockReturnValue(2);
      mockUserConfig.getAiCommitsGenerated.mockReturnValue(0);

      const result = analysisService.calculateEstimatedTimeSaved();

      expect(result).toBe('10 minutes'); // 2 * 5
    });

    it('should calculate time from AI commits', () => {
      mockUserConfig.getErrorsPreventedCount.mockReturnValue(0);
      mockUserConfig.getAiCommitsGenerated.mockReturnValue(30);

      const result = analysisService.calculateEstimatedTimeSaved();

      expect(result).toBe('30 minutes'); // 30 * 1
    });

    it('should format hours when >= 60 minutes', () => {
      mockUserConfig.getErrorsPreventedCount.mockReturnValue(12);
      mockUserConfig.getAiCommitsGenerated.mockReturnValue(0);

      const result = analysisService.calculateEstimatedTimeSaved();

      expect(result).toBe('1 hour'); // 12 * 5 = 60
    });

    it('should format hours and minutes', () => {
      mockUserConfig.getErrorsPreventedCount.mockReturnValue(13);
      mockUserConfig.getAiCommitsGenerated.mockReturnValue(0);

      const result = analysisService.calculateEstimatedTimeSaved();

      expect(result).toBe('1h 5m'); // 13 * 5 = 65
    });

    it('should combine errors and AI time', () => {
      mockUserConfig.getErrorsPreventedCount.mockReturnValue(1);
      mockUserConfig.getAiCommitsGenerated.mockReturnValue(5);

      const result = analysisService.calculateEstimatedTimeSaved();

      expect(result).toBe('10 minutes'); // 5 + 5
    });
  });

  describe('getQuickStatus', () => {
    it('should include branch name', async () => {
      mockGitService.getStatus.mockResolvedValue({
        current: 'feature-x',
        tracking: 'origin/feature-x',
        staged: [],
        modified: [],
        untracked: [],
        ahead: 0,
        behind: 0,
        isClean: true,
        deleted: []
      });

      const result = await analysisService.getQuickStatus();

      expect(result).toContain('[feature-x]');
      expect(result).toContain('✓');
    });

    it('should show staged, modified, and untracked counts', async () => {
      mockGitService.getStatus.mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        staged: ['a.ts'],
        modified: ['b.ts', 'c.ts'],
        untracked: ['d.ts', 'e.ts', 'f.ts'],
        ahead: 0,
        behind: 0,
        isClean: false,
        deleted: []
      });

      const result = await analysisService.getQuickStatus();

      expect(result).toContain('+1'); // staged
      expect(result).toContain('~2'); // modified
      expect(result).toContain('?3'); // untracked
    });

    it('should show ahead and behind indicators', async () => {
      mockGitService.getStatus.mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        staged: [],
        modified: [],
        untracked: [],
        ahead: 5,
        behind: 3,
        isClean: true,
        deleted: []
      });

      const result = await analysisService.getQuickStatus();

      expect(result).toContain('↑5');
      expect(result).toContain('↓3');
    });
  });
});
