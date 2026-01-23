import Conf from 'conf';
import {
  DEFAULT_PREFERENCES,
  DEFAULT_APP_CONFIG,
  UserPreferences,
  AppConfig,
  Language,
  Theme,
  ExperienceLevel
} from './defaults.js';

interface ConfigSchema {
  preferences: UserPreferences;
  app: AppConfig;
}

const config = new Conf<ConfigSchema>({
  projectName: 'gitcoach',
  defaults: {
    preferences: DEFAULT_PREFERENCES,
    app: DEFAULT_APP_CONFIG
  }
});

export const userConfig = {
  // Preferences getters
  getLanguage(): Language {
    return config.get('preferences.language', DEFAULT_PREFERENCES.language);
  },

  getTheme(): Theme {
    return config.get('preferences.theme', DEFAULT_PREFERENCES.theme);
  },

  getExperienceLevel(): ExperienceLevel {
    return config.get('preferences.experienceLevel', DEFAULT_PREFERENCES.experienceLevel);
  },

  getShowTips(): boolean {
    return config.get('preferences.showTips', DEFAULT_PREFERENCES.showTips);
  },

  getConfirmDestructiveActions(): boolean {
    return config.get('preferences.confirmDestructiveActions', DEFAULT_PREFERENCES.confirmDestructiveActions);
  },

  getAutoGenerateCommitMessages(): boolean {
    return config.get('preferences.autoGenerateCommitMessages', DEFAULT_PREFERENCES.autoGenerateCommitMessages);
  },

  getDefaultBranch(): string {
    return config.get('preferences.defaultBranch', DEFAULT_PREFERENCES.defaultBranch);
  },

  getAllPreferences(): UserPreferences {
    return config.get('preferences', DEFAULT_PREFERENCES);
  },

  // Preferences setters
  setLanguage(language: Language): void {
    config.set('preferences.language', language);
  },

  setTheme(theme: Theme): void {
    config.set('preferences.theme', theme);
  },

  setExperienceLevel(level: ExperienceLevel): void {
    config.set('preferences.experienceLevel', level);
  },

  setShowTips(show: boolean): void {
    config.set('preferences.showTips', show);
  },

  setConfirmDestructiveActions(confirm: boolean): void {
    config.set('preferences.confirmDestructiveActions', confirm);
  },

  setAutoGenerateCommitMessages(auto: boolean): void {
    config.set('preferences.autoGenerateCommitMessages', auto);
  },

  setDefaultBranch(branch: string): void {
    config.set('preferences.defaultBranch', branch);
  },

  setPreferences(preferences: Partial<UserPreferences>): void {
    const current = config.get('preferences', DEFAULT_PREFERENCES);
    config.set('preferences', { ...current, ...preferences });
  },

  // App config getters
  isFirstRun(): boolean {
    return config.get('app.firstRun', DEFAULT_APP_CONFIG.firstRun);
  },

  getAppVersion(): string {
    return config.get('app.version', DEFAULT_APP_CONFIG.version);
  },

  getTotalCommits(): number {
    return config.get('app.totalCommits', DEFAULT_APP_CONFIG.totalCommits);
  },

  getErrorsPreventedCount(): number {
    return config.get('app.errorsPreventedCount', DEFAULT_APP_CONFIG.errorsPreventedCount);
  },

  getAiCommitsGenerated(): number {
    return config.get('app.aiCommitsGenerated', DEFAULT_APP_CONFIG.aiCommitsGenerated);
  },

  // App config setters
  setFirstRunComplete(): void {
    config.set('app.firstRun', false);
  },

  updateLastUsed(): void {
    config.set('app.lastUsed', new Date().toISOString());
  },

  incrementTotalCommits(): void {
    const current = config.get('app.totalCommits', 0);
    config.set('app.totalCommits', current + 1);
  },

  incrementErrorsPrevented(): void {
    const current = config.get('app.errorsPreventedCount', 0);
    config.set('app.errorsPreventedCount', current + 1);
  },

  incrementAiCommitsGenerated(): void {
    const current = config.get('app.aiCommitsGenerated', 0);
    config.set('app.aiCommitsGenerated', current + 1);
  },

  // Utility methods
  reset(): void {
    config.clear();
  },

  getConfigPath(): string {
    return config.path;
  }
};

export default userConfig;
