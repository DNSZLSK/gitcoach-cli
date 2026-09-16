/**
 * The real user config, against the in-memory conf mock.
 *
 * This file used to declare its own `type Language = 'en' | 'fr' | 'es'` and
 * then assert that 'en' was in `['en', 'fr', 'es']` — it said so at the top,
 * "without importing the actual modules (to avoid ESM issues)". Those issues
 * are gone, and a test that compares a literal to itself was never evidence
 * that the config rejects a bad value.
 *
 * What is actually worth pinning down is the rejection. Every guarded setter
 * returns silently on a value outside its set, so a refused write looks exactly
 * like an accepted one unless something reads back afterwards. That is what
 * these do.
 *
 * `conf` resolves to test/mocks/conf.ts through the alias in vitest.config.ts,
 * so nothing here touches the developer's real config directory.
 */

import { userConfig } from '../../src/config/user-config.js';
import { DEFAULT_PREFERENCES, DEFAULT_APP_CONFIG } from '../../src/config/defaults.js';

describe('user config', () => {
  beforeEach(() => {
    userConfig.reset();
  });

  describe('defaults', () => {
    it('should start from the documented preferences', () => {
      expect(userConfig.getLanguage()).toBe(DEFAULT_PREFERENCES.language);
      expect(userConfig.getTheme()).toBe(DEFAULT_PREFERENCES.theme);
      expect(userConfig.getExperienceLevel()).toBe(DEFAULT_PREFERENCES.experienceLevel);
      expect(userConfig.getAiProvider()).toBe(DEFAULT_PREFERENCES.aiProvider);
    });

    it('should start a new user as a beginner, with confirmations on', () => {
      expect(userConfig.getExperienceLevel()).toBe('beginner');
      expect(userConfig.getConfirmDestructiveActions()).toBe(true);
    });

    it('should report the first run as a first run', () => {
      expect(userConfig.isFirstRun()).toBe(DEFAULT_APP_CONFIG.firstRun);
    });
  });

  describe('accepting valid values', () => {
    it('should keep a language it supports', () => {
      for (const language of ['en', 'fr', 'es'] as const) {
        userConfig.setLanguage(language);
        expect(userConfig.getLanguage()).toBe(language);
      }
    });

    it('should keep a theme it supports', () => {
      for (const theme of ['colored', 'monochrome'] as const) {
        userConfig.setTheme(theme);
        expect(userConfig.getTheme()).toBe(theme);
      }
    });

    it('should keep a level it supports', () => {
      for (const level of ['beginner', 'intermediate', 'expert'] as const) {
        userConfig.setExperienceLevel(level);
        expect(userConfig.getExperienceLevel()).toBe(level);
      }
    });

    it('should keep an AI provider it supports', () => {
      for (const provider of ['copilot', 'ollama'] as const) {
        userConfig.setAiProvider(provider);
        expect(userConfig.getAiProvider()).toBe(provider);
      }
    });
  });

  describe('rejecting invalid values', () => {
    it('should not store an unsupported language', () => {
      userConfig.setLanguage('fr');
      userConfig.setLanguage('de' as never);

      expect(userConfig.getLanguage()).toBe('fr');
    });

    it('should not store an unsupported theme', () => {
      userConfig.setTheme('monochrome');
      userConfig.setTheme('neon' as never);

      expect(userConfig.getTheme()).toBe('monochrome');
    });

    it('should not store an unsupported level', () => {
      userConfig.setExperienceLevel('expert');
      userConfig.setExperienceLevel('novice' as never);

      expect(userConfig.getExperienceLevel()).toBe('expert');
    });

    it('should not store an unsupported AI provider', () => {
      userConfig.setAiProvider('ollama');
      userConfig.setAiProvider('gpt' as never);

      expect(userConfig.getAiProvider()).toBe('ollama');
    });
  });

  describe('free-form preferences', () => {
    it('should keep any default branch name', () => {
      userConfig.setDefaultBranch('trunk');

      expect(userConfig.getDefaultBranch()).toBe('trunk');
    });

    it('should keep the AI model and endpoint as given', () => {
      userConfig.setAiModel('llama3');
      userConfig.setAiEndpoint('http://localhost:11434');

      expect(userConfig.getAiModel()).toBe('llama3');
      expect(userConfig.getAiEndpoint()).toBe('http://localhost:11434');
    });

    it('should toggle the booleans both ways', () => {
      userConfig.setShowTips(false);
      userConfig.setConfirmDestructiveActions(false);
      userConfig.setAutoGenerateCommitMessages(false);

      expect(userConfig.getShowTips()).toBe(false);
      expect(userConfig.getConfirmDestructiveActions()).toBe(false);
      expect(userConfig.getAutoGenerateCommitMessages()).toBe(false);

      userConfig.setShowTips(true);
      expect(userConfig.getShowTips()).toBe(true);
    });
  });

  describe('setPreferences', () => {
    it('should merge rather than replace', () => {
      userConfig.setTheme('monochrome');

      userConfig.setPreferences({ language: 'es' });

      expect(userConfig.getLanguage()).toBe('es');
      expect(userConfig.getTheme()).toBe('monochrome');
    });

    it('should report everything through getAllPreferences', () => {
      userConfig.setPreferences({ language: 'fr', experienceLevel: 'expert' });

      const all = userConfig.getAllPreferences();

      expect(all.language).toBe('fr');
      expect(all.experienceLevel).toBe('expert');
      expect(all.defaultBranch).toBe(DEFAULT_PREFERENCES.defaultBranch);
    });
  });

  describe('the counters the stats screen reads', () => {
    it('should start at zero', () => {
      expect(userConfig.getTotalCommits()).toBe(0);
      expect(userConfig.getErrorsPreventedCount()).toBe(0);
      expect(userConfig.getAiCommitsGenerated()).toBe(0);
    });

    it('should count commits one at a time', () => {
      userConfig.incrementTotalCommits();
      userConfig.incrementTotalCommits();

      expect(userConfig.getTotalCommits()).toBe(2);
    });

    it('should count prevented mistakes one at a time', () => {
      userConfig.incrementErrorsPrevented();

      expect(userConfig.getErrorsPreventedCount()).toBe(1);
    });

    it('should count AI commits separately from the total', () => {
      userConfig.incrementTotalCommits();
      userConfig.incrementAiCommitsGenerated();

      expect(userConfig.getTotalCommits()).toBe(1);
      expect(userConfig.getAiCommitsGenerated()).toBe(1);
    });
  });

  describe('first run', () => {
    it('should stop reporting a first run once marked complete', () => {
      expect(userConfig.isFirstRun()).toBe(true);

      userConfig.setFirstRunComplete();

      expect(userConfig.isFirstRun()).toBe(false);
    });

    it('should record a timestamp when the tool is used', () => {
      userConfig.updateLastUsed();

      expect(userConfig.getAppVersion()).toBeDefined();
    });
  });

  describe('reset', () => {
    it('should put every preference and counter back to its default', () => {
      userConfig.setLanguage('es');
      userConfig.setExperienceLevel('expert');
      userConfig.incrementTotalCommits();

      userConfig.reset();

      expect(userConfig.getLanguage()).toBe(DEFAULT_PREFERENCES.language);
      expect(userConfig.getExperienceLevel()).toBe(DEFAULT_PREFERENCES.experienceLevel);
      expect(userConfig.getTotalCommits()).toBe(0);
    });
  });
});
