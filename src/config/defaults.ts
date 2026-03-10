export type Language = 'en' | 'fr' | 'es';
export type Theme = 'colored' | 'monochrome';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'expert';

export interface UserPreferences {
  language: Language;
  theme: Theme;
  experienceLevel: ExperienceLevel;
  showTips: boolean;
  confirmDestructiveActions: boolean;
  autoGenerateCommitMessages: boolean;
  defaultBranch: string;
}

export interface AppConfig {
  version: string;
  firstRun: boolean;
  lastUsed: string;
  totalCommits: number;
  errorsPreventedCount: number;
  aiCommitsGenerated: number;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'en',
  theme: 'colored',
  experienceLevel: 'beginner',
  showTips: true,
  confirmDestructiveActions: true,
  autoGenerateCommitMessages: true,
  defaultBranch: 'main'
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  version: '1.0.0',
  firstRun: true,
  lastUsed: new Date().toISOString(),
  totalCommits: 0,
  errorsPreventedCount: 0,
  aiCommitsGenerated: 0
};

export const SUPPORTED_LANGUAGES: { code: Language; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' }
];

export const EXPERIENCE_LEVELS: { level: ExperienceLevel; description: string }[] = [
  { level: 'beginner', description: 'Verbose explanations and step-by-step guidance' },
  { level: 'intermediate', description: 'Helpful tips with moderate explanations' },
  { level: 'expert', description: 'Minimal output, only warnings and errors' }
];

export const THEMES: { theme: Theme; description: string }[] = [
  { theme: 'colored', description: 'Colorful output with syntax highlighting' },
  { theme: 'monochrome', description: 'Plain text output without colors' }
];

export const VALID_LANGUAGES: ReadonlySet<string> = new Set(['en', 'fr', 'es']);
export const VALID_THEMES: ReadonlySet<string> = new Set(['colored', 'monochrome']);
export const VALID_LEVELS: ReadonlySet<string> = new Set(['beginner', 'intermediate', 'expert']);
