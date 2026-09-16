import type { Mocked, MockedFunction } from 'vitest';

/**
 * Behaviour tests for the real config menu.
 *
 * Replaces test/integration/config.test.ts, which built a plain object called
 * `mockConfig`, assigned to it, and asserted the assignment had happened.
 * Twenty-four tests, no production line executed.
 *
 * The behaviour that matters here is small but easy to get wrong: each toggle
 * must offer the *current* value as its default, or a user pressing enter
 * flips a setting they meant to leave alone; and the reset must not fire
 * without a yes.
 */

vi.mock('../../src/i18n/index.js', () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
  changeLanguage: vi.fn()
}));

vi.mock('../../src/utils/logger.js', async () =>
  (await import('../helpers/module-mocks.js')).loggerMock());

vi.mock('../../src/ui/themes/index.js', async () =>
  (await import('../helpers/module-mocks.js')).themeMock());

vi.mock('../../src/ui/components/box.js', async () =>
  (await import('../helpers/module-mocks.js')).boxMock());

vi.mock('../../src/ui/components/spinner.js', async () =>
  (await import('../helpers/module-mocks.js')).spinnerMock());

vi.mock('../../src/ui/components/prompt.js', async () =>
  (await import('../helpers/module-mocks.js')).promptMock());

vi.mock('../../src/services/copilot-service.js', () => ({
  copilotService: {
    resetAvailability: vi.fn(),
    isAvailable: vi.fn()
  }
}));

vi.mock('../../src/config/user-config.js', () => ({
  userConfig: {
    getLanguage: vi.fn(),
    getTheme: vi.fn(),
    getExperienceLevel: vi.fn(),
    getShowTips: vi.fn(),
    getConfirmDestructiveActions: vi.fn(),
    getAutoGenerateCommitMessages: vi.fn(),
    getAiProvider: vi.fn(),
    getAiModel: vi.fn(),
    setTheme: vi.fn(),
    setExperienceLevel: vi.fn(),
    setShowTips: vi.fn(),
    setConfirmDestructiveActions: vi.fn(),
    setAutoGenerateCommitMessages: vi.fn(),
    setAiProvider: vi.fn(),
    setAiModel: vi.fn(),
    reset: vi.fn()
  }
}));

import { showConfigMenu } from '../../src/ui/menus/config-menu.js';
import { userConfig } from '../../src/config/user-config.js';
import { copilotService } from '../../src/services/copilot-service.js';
import { changeLanguage } from '../../src/i18n/index.js';
import { promptSelect, promptConfirm, promptInput } from '../../src/ui/components/prompt.js';

const config = userConfig as Mocked<typeof userConfig>;
const copilot = copilotService as Mocked<typeof copilotService>;
const setLanguage = changeLanguage as MockedFunction<typeof changeLanguage>;
const select = promptSelect as MockedFunction<typeof promptSelect>;
const confirm = promptConfirm as MockedFunction<typeof promptConfirm>;
const input = promptInput as MockedFunction<typeof promptInput>;

/** Pick one entry, answer any follow-up select, then leave the loop. */
const choose = (action: string, follow?: unknown) => {
  select.mockResolvedValueOnce(action as never);
  if (follow !== undefined) {
    select.mockResolvedValueOnce(follow as never);
  }
  select.mockResolvedValue('back' as never);
};

describe('Config menu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    config.getLanguage.mockReturnValue('en');
    config.getTheme.mockReturnValue('colored');
    config.getExperienceLevel.mockReturnValue('beginner');
    config.getShowTips.mockReturnValue(true);
    config.getConfirmDestructiveActions.mockReturnValue(true);
    config.getAutoGenerateCommitMessages.mockReturnValue(true);
    config.getAiProvider.mockReturnValue('copilot');
    config.getAiModel.mockReturnValue('');
    copilot.isAvailable.mockResolvedValue(true);
    confirm.mockResolvedValue(true);
    input.mockResolvedValue('');
  });

  it('should change nothing when the user backs out', async () => {
    select.mockResolvedValue('back' as never);

    await showConfigMenu();

    expect(config.setTheme).not.toHaveBeenCalled();
    expect(config.setExperienceLevel).not.toHaveBeenCalled();
    expect(config.reset).not.toHaveBeenCalled();
  });

  it('should keep offering the menu until the user backs out', async () => {
    select
      .mockResolvedValueOnce('tips' as never)
      .mockResolvedValueOnce('tips' as never)
      .mockResolvedValue('back' as never);

    await showConfigMenu();

    expect(select).toHaveBeenCalledTimes(3);
  });

  describe('language', () => {
    it('should apply the chosen language', async () => {
      choose('language', 'fr');

      await showConfigMenu();

      expect(setLanguage).toHaveBeenCalledWith('fr');
    });

    it('should offer every supported language', async () => {
      choose('language', 'en');

      await showConfigMenu();

      const offered = (select.mock.calls[1][1] as { value: string }[]).map(c => c.value);
      expect(offered).toEqual(['en', 'fr', 'es']);
    });
  });

  describe('theme and level', () => {
    it('should store the chosen theme', async () => {
      choose('theme', 'monochrome');

      await showConfigMenu();

      expect(config.setTheme).toHaveBeenCalledWith('monochrome');
    });

    it('should store the chosen level', async () => {
      choose('level', 'expert');

      await showConfigMenu();

      expect(config.setExperienceLevel).toHaveBeenCalledWith('expert');
    });

    it('should offer every level', async () => {
      choose('level', 'beginner');

      await showConfigMenu();

      const offered = (select.mock.calls[1][1] as { value: string }[]).map(c => c.value);
      expect(offered).toEqual(['beginner', 'intermediate', 'expert']);
    });
  });

  describe('the toggles', () => {
    // Each of these offers the current value as the prompt default. Getting it
    // wrong means pressing enter silently flips the setting.
    it('should default the tips question to the current value', async () => {
      config.getShowTips.mockReturnValue(false);
      choose('tips');

      await showConfigMenu();

      expect(confirm.mock.calls[0][1]).toBe(false);
    });

    it('should default the destructive-confirmation question to the current value', async () => {
      config.getConfirmDestructiveActions.mockReturnValue(false);
      choose('confirmActions');

      await showConfigMenu();

      expect(confirm.mock.calls[0][1]).toBe(false);
    });

    it('should default the auto-commit question to the current value', async () => {
      config.getAutoGenerateCommitMessages.mockReturnValue(false);
      choose('autoCommit');

      await showConfigMenu();

      expect(confirm.mock.calls[0][1]).toBe(false);
    });

    it('should store whatever the user answers, including no', async () => {
      confirm.mockResolvedValue(false);
      choose('tips');

      await showConfigMenu();

      expect(config.setShowTips).toHaveBeenCalledWith(false);
    });

    it('should store a yes as a yes', async () => {
      confirm.mockResolvedValue(true);
      choose('confirmActions');

      await showConfigMenu();

      expect(config.setConfirmDestructiveActions).toHaveBeenCalledWith(true);
    });
  });

  describe('the AI provider', () => {
    it('should store the chosen provider', async () => {
      choose('aiProvider', 'ollama');
      input.mockResolvedValue('llama3');

      await showConfigMenu();

      expect(config.setAiProvider).toHaveBeenCalledWith('ollama');
    });

    it('should ask for a model only when Ollama is chosen', async () => {
      choose('aiProvider', 'copilot');

      await showConfigMenu();

      expect(input).not.toHaveBeenCalled();
      expect(config.setAiModel).not.toHaveBeenCalled();
    });

    it('should store the model Ollama is given', async () => {
      choose('aiProvider', 'ollama');
      input.mockResolvedValue('  llama3  ');

      await showConfigMenu();

      expect(config.setAiModel).toHaveBeenCalledWith('llama3');
    });

    it('should leave the model alone when the answer is blank', async () => {
      choose('aiProvider', 'ollama');
      input.mockResolvedValue('   ');

      await showConfigMenu();

      expect(config.setAiModel).not.toHaveBeenCalled();
    });
  });

  describe('rechecking Copilot', () => {
    it('should clear the cached answer before asking again', async () => {
      choose('copilotRefresh');

      await showConfigMenu();

      expect(copilot.resetAvailability).toHaveBeenCalledTimes(1);
      expect(copilot.resetAvailability.mock.invocationCallOrder[0]).toBeLessThan(
        copilot.isAvailable.mock.invocationCallOrder[0]
      );
    });

    it('should cope with Copilot being unavailable', async () => {
      choose('copilotRefresh');
      copilot.isAvailable.mockResolvedValue(false);

      await expect(showConfigMenu()).resolves.toBeUndefined();
    });
  });

  describe('reset', () => {
    it('should ask first, defaulting to no', async () => {
      choose('reset');

      await showConfigMenu();

      expect(confirm.mock.calls[0][1]).toBe(false);
      expect(config.reset).toHaveBeenCalledTimes(1);
    });

    it('should reset nothing when the confirmation is declined', async () => {
      choose('reset');
      confirm.mockResolvedValue(false);

      await showConfigMenu();

      expect(config.reset).not.toHaveBeenCalled();
    });
  });
});
