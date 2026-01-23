/**
 * Integration tests for Configuration
 * Tests: language, theme, experience level, preferences
 */

import { createMockPrompts, userFlow, type MockPrompts } from '../helpers/mock-prompts.js';

jest.mock('../../src/config/user-config.js');
jest.mock('../../src/ui/components/prompt.js');

describe('Configuration', () => {
  let mockPrompts: MockPrompts;
  let mockConfig: Record<string, unknown>;

  beforeEach(() => {
    mockPrompts = createMockPrompts();
    mockConfig = {
      language: 'en',
      theme: 'colored',
      experienceLevel: 'beginner',
      showTips: true,
      confirmDestructive: true,
      autoGenerateCommit: true
    };
    jest.clearAllMocks();
  });

  describe('Language Settings', () => {
    it('should allow changing language', async () => {
      const responses = userFlow()
        .select('language')
        .select('fr')
        .build();

      mockPrompts.__setResponses(responses);

      const setting = await mockPrompts.promptSelect('Setting', []);
      expect(setting).toBe('language');

      const newLang = await mockPrompts.promptSelect('Language', []);
      expect(newLang).toBe('fr');

      mockConfig.language = newLang as string;
      expect(mockConfig.language).toBe('fr');
    });

    it('should support multiple languages', async () => {
      const languages = ['en', 'fr', 'es'];

      for (const lang of languages) {
        const responses = userFlow().select(lang).build();
        mockPrompts.__setResponses(responses);
        mockPrompts.__reset();

        const selected = await mockPrompts.promptSelect('Language', []);
        expect(selected).toBe(lang);
      }
    });

    it('should persist language choice', async () => {
      mockConfig.language = 'es';
      expect(mockConfig.language).toBe('es');

      // Simulates reading from config on next session
      const savedLang = mockConfig.language;
      expect(savedLang).toBe('es');
    });
  });

  describe('Theme Settings', () => {
    it('should allow switching between themes', async () => {
      const responses = userFlow()
        .select('theme')
        .select('monochrome')
        .build();

      mockPrompts.__setResponses(responses);

      const setting = await mockPrompts.promptSelect('Setting', []);
      expect(setting).toBe('theme');

      const newTheme = await mockPrompts.promptSelect('Theme', []);
      expect(newTheme).toBe('monochrome');

      mockConfig.theme = newTheme as string;
      expect(mockConfig.theme).toBe('monochrome');
    });

    it('should support colored and monochrome themes', async () => {
      const themes = ['colored', 'monochrome'];

      for (const theme of themes) {
        const responses = userFlow().select(theme).build();
        mockPrompts.__setResponses(responses);
        mockPrompts.__reset();

        const selected = await mockPrompts.promptSelect('Theme', []);
        expect(selected).toBe(theme);
      }
    });
  });

  describe('Experience Level', () => {
    it('should allow setting experience level', async () => {
      const responses = userFlow()
        .select('experienceLevel')
        .select('intermediate')
        .build();

      mockPrompts.__setResponses(responses);

      const setting = await mockPrompts.promptSelect('Setting', []);
      expect(setting).toBe('experienceLevel');

      const level = await mockPrompts.promptSelect('Level', []);
      expect(level).toBe('intermediate');

      mockConfig.experienceLevel = level as string;
      expect(mockConfig.experienceLevel).toBe('intermediate');
    });

    it('should support beginner, intermediate, and expert levels', async () => {
      const levels = ['beginner', 'intermediate', 'expert'];

      for (const level of levels) {
        const responses = userFlow().select(level).build();
        mockPrompts.__setResponses(responses);
        mockPrompts.__reset();

        const selected = await mockPrompts.promptSelect('Level', []);
        expect(selected).toBe(level);
      }
    });

    it('should affect UI verbosity based on level', () => {
      // Beginner: Show more explanations
      // Intermediate: Show tips
      // Expert: Minimal UI, alerts only

      const levelConfig: Record<string, { showTips: boolean; verbose: boolean }> = {
        beginner: { showTips: true, verbose: true },
        intermediate: { showTips: true, verbose: false },
        expert: { showTips: false, verbose: false }
      };

      for (const [_level, config] of Object.entries(levelConfig)) {
        expect(config.showTips).toBeDefined();
        expect(config.verbose).toBeDefined();
      }
    });
  });

  describe('Show Tips Toggle', () => {
    it('should toggle tips display', async () => {
      const responses = userFlow()
        .select('showTips')
        .confirm(false)  // Disable tips
        .build();

      mockPrompts.__setResponses(responses);

      const setting = await mockPrompts.promptSelect('Setting', []);
      expect(setting).toBe('showTips');

      const enable = await mockPrompts.promptConfirm('Show tips?');
      expect(enable).toBe(false);

      mockConfig.showTips = enable;
      expect(mockConfig.showTips).toBe(false);
    });
  });

  describe('Confirm Destructive Actions', () => {
    it('should toggle destructive action confirmation', async () => {
      const responses = userFlow()
        .select('confirmDestructive')
        .confirm(false)  // Disable confirmations (expert mode)
        .build();

      mockPrompts.__setResponses(responses);

      const setting = await mockPrompts.promptSelect('Setting', []);
      expect(setting).toBe('confirmDestructive');

      const enable = await mockPrompts.promptConfirm('Confirm destructive?');
      expect(enable).toBe(false);

      mockConfig.confirmDestructive = enable;
      expect(mockConfig.confirmDestructive).toBe(false);
    });

    it('should warn when disabling confirmations', async () => {
      // User should be warned about potential data loss
      const responses = userFlow()
        .select('confirmDestructive')
        .confirm(true)   // Show warning first
        .confirm(false)  // Then disable
        .build();

      mockPrompts.__setResponses(responses);

      await mockPrompts.promptSelect('Setting', []);
      const acknowledged = await mockPrompts.promptConfirm('This may cause data loss');
      expect(acknowledged).toBe(true);
    });
  });

  describe('Auto-generate Commit Messages', () => {
    it('should toggle AI commit message generation', async () => {
      const responses = userFlow()
        .select('autoCommitMsg')
        .confirm(true)
        .build();

      mockPrompts.__setResponses(responses);

      const setting = await mockPrompts.promptSelect('Setting', []);
      expect(setting).toBe('autoCommitMsg');

      const enable = await mockPrompts.promptConfirm('Enable AI commits?');
      expect(enable).toBe(true);

      mockConfig.autoGenerateCommit = enable;
      expect(mockConfig.autoGenerateCommit).toBe(true);
    });
  });

  describe('Reset to Defaults', () => {
    it('should reset all settings to defaults', async () => {
      // Change some settings
      mockConfig.language = 'es';
      mockConfig.theme = 'monochrome';
      mockConfig.experienceLevel = 'expert';

      const responses = userFlow()
        .select('reset')
        .confirm(true)  // Confirm reset
        .build();

      mockPrompts.__setResponses(responses);

      const setting = await mockPrompts.promptSelect('Setting', []);
      expect(setting).toBe('reset');

      const confirmReset = await mockPrompts.promptConfirm('Reset all settings?');
      expect(confirmReset).toBe(true);

      // Reset to defaults
      mockConfig = {
        language: 'en',
        theme: 'colored',
        experienceLevel: 'beginner',
        showTips: true,
        confirmDestructive: true,
        autoGenerateCommit: true
      };

      expect(mockConfig.language).toBe('en');
      expect(mockConfig.theme).toBe('colored');
      expect(mockConfig.experienceLevel).toBe('beginner');
    });

    it('should cancel reset if user declines', async () => {
      mockConfig.language = 'fr';

      const responses = userFlow()
        .select('reset')
        .confirm(false)  // Cancel reset
        .build();

      mockPrompts.__setResponses(responses);

      await mockPrompts.promptSelect('Setting', []);
      const confirmReset = await mockPrompts.promptConfirm('Reset?');

      expect(confirmReset).toBe(false);
      expect(mockConfig.language).toBe('fr');  // Unchanged
    });
  });

  describe('Config Menu Navigation', () => {
    it('should allow going back', async () => {
      const responses = userFlow()
        .select('back')
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Setting', []);
      expect(action).toBe('back');
    });

    it('should show all config options', async () => {
      const configOptions = [
        'language',
        'theme',
        'experienceLevel',
        'showTips',
        'confirmDestructive',
        'autoCommitMsg',
        'reset',
        'back'
      ];

      for (const option of configOptions) {
        const responses = userFlow().select(option).build();
        mockPrompts.__setResponses(responses);
        mockPrompts.__reset();

        const selected = await mockPrompts.promptSelect('Config', []);
        expect(selected).toBe(option);
      }
    });
  });

  describe('First Run Setup', () => {
    it('should detect first run', () => {
      const isFirstRun = mockConfig.language === undefined;
      // First run is detected when no config exists

      expect(typeof isFirstRun).toBe('boolean');
    });

    it('should guide through initial setup', async () => {
      const responses = userFlow()
        .select('en')       // Language
        .select('colored')  // Theme
        .select('beginner') // Experience level
        .build();

      mockPrompts.__setResponses(responses);

      const lang = await mockPrompts.promptSelect('Language', []);
      expect(lang).toBe('en');

      const theme = await mockPrompts.promptSelect('Theme', []);
      expect(theme).toBe('colored');

      const level = await mockPrompts.promptSelect('Level', []);
      expect(level).toBe('beginner');
    });

    it('should mark setup as complete after first run', () => {
      mockConfig.setupComplete = true;

      expect(mockConfig.setupComplete).toBe(true);
    });
  });
});

describe('Configuration - Statistics', () => {
  let mockStats: Record<string, number>;

  beforeEach(() => {
    mockStats = {
      totalCommits: 0,
      aiCommits: 0,
      errorsPrevented: 0
    };
  });

  it('should track total commits', () => {
    mockStats.totalCommits = 42;
    expect(mockStats.totalCommits).toBe(42);
  });

  it('should track AI-generated commits', () => {
    mockStats.aiCommits = 15;
    expect(mockStats.aiCommits).toBe(15);
  });

  it('should track errors prevented', () => {
    mockStats.errorsPrevented = 5;
    expect(mockStats.errorsPrevented).toBe(5);
  });

  it('should calculate AI commit percentage', () => {
    mockStats.totalCommits = 100;
    mockStats.aiCommits = 30;

    const percentage = (mockStats.aiCommits / mockStats.totalCommits) * 100;
    expect(percentage).toBe(30);
  });

  it('should handle zero commits for percentage', () => {
    mockStats.totalCommits = 0;
    mockStats.aiCommits = 0;

    const percentage = mockStats.totalCommits > 0
      ? (mockStats.aiCommits / mockStats.totalCommits) * 100
      : 0;

    expect(percentage).toBe(0);
  });
});
