import type { Mocked, MockedFunction } from 'vitest';

/**
 * Every entry of the real main menu must render a translated label, in all
 * three languages and at all three levels.
 *
 * This exists because it did not, and nobody noticed. `getMenuLabel('tags')`
 * looks up `menu.tagsBeginner`, and when Tags and Advanced were added their
 * level variants were not, so i18next returned the key and the menu printed
 * "menu.tagsBeginner" to the user. A key-parity check across locales cannot
 * catch that: the key was missing from all three alike.
 *
 * So this renders the menu for real — real i18n, real theme, real label
 * lookup — and reads what a user would see. Only the git probes and the prompt
 * are replaced.
 */

vi.mock('../../src/services/git-service.js', () => ({
  gitService: { isDetachedHead: vi.fn().mockResolvedValue(false) }
}));

vi.mock('../../src/services/analysis-service.js', () => ({
  analysisService: { getQuickStatus: vi.fn().mockResolvedValue('') }
}));

vi.mock('../../src/ui/flows/in-progress.js', () => ({
  detectInProgress: vi.fn().mockResolvedValue(null),
  runInProgressFlow: vi.fn()
}));

vi.mock('../../src/ui/menus/detached-head-menu.js', () => ({
  showDetachedHeadMenu: vi.fn(),
  handleDetachedHead: vi.fn()
}));

vi.mock('../../src/ui/components/prompt.js', async () =>
  (await import('../helpers/module-mocks.js')).promptMock());

vi.mock('../../src/utils/logger.js', async () =>
  (await import('../helpers/module-mocks.js')).loggerMock());

vi.mock('../../src/ui/components/box.js', async () =>
  (await import('../helpers/module-mocks.js')).boxMock());

import { showMainMenu } from '../../src/ui/menus/main-menu.js';
import { promptSelect } from '../../src/ui/components/prompt.js';
import { initI18n, changeLanguage } from '../../src/i18n/index.js';
import { userConfig } from '../../src/config/user-config.js';
import type { ExperienceLevel, Language } from '../../src/config/defaults.js';

const select = promptSelect as MockedFunction<typeof promptSelect>;

const LANGUAGES: Language[] = ['en', 'fr', 'es'];
const LEVELS: ExperienceLevel[] = ['beginner', 'intermediate', 'expert'];

/** Render the menu once and return the labels a user would read. */
async function renderedLabels(): Promise<string[]> {
  select.mockResolvedValue('quit' as never);
  await showMainMenu();
  return (select.mock.calls.at(-1)?.[1] as { name: string }[]).map(choice => choice.name);
}

describe('Main menu labels', () => {
  beforeAll(async () => {
    // userConfig writes to the in-memory conf mock, not to a real file.
    await initI18n();
  });

  afterAll(() => {
    changeLanguage('en');
    userConfig.setExperienceLevel('beginner');
  });

  for (const language of LANGUAGES) {
    for (const level of LEVELS) {
      it(`should translate every entry in ${language} at ${level} level`, async () => {
        changeLanguage(language);
        userConfig.setExperienceLevel(level);

        const labels = await renderedLabels();

        expect(labels.length).toBeGreaterThan(10);
        // An unresolved lookup renders as the key itself, dots and all.
        const untranslated = labels.filter(label => /\b(menu|commands)\.[a-zA-Z]/.test(label));
        expect(untranslated).toEqual([]);
        expect(labels.every(label => label.trim().length > 0)).toBe(true);
      });
    }
  }

  it('should give every entry a distinct value', async () => {
    changeLanguage('en');
    userConfig.setExperienceLevel('beginner');
    select.mockResolvedValue('quit' as never);

    await showMainMenu();

    const values = (select.mock.calls.at(-1)?.[1] as { value: string }[]).map(c => c.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('should offer a way out', async () => {
    changeLanguage('en');
    select.mockResolvedValue('quit' as never);

    await showMainMenu();

    const values = (select.mock.calls.at(-1)?.[1] as { value: string }[]).map(c => c.value);
    expect(values).toContain('quit');
  });
});
