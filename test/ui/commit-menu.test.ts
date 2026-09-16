import type { Mocked, MockedFunction } from 'vitest';

/**
 * Behaviour tests for the real commit menu.
 *
 * What this menu must get right is mostly refusal: it must not commit on top of
 * unresolved conflicts, must not commit a staged secret without being told to
 * twice, and must not invent a message the user did not approve. So the
 * assertions are about `gitService.commit` — whether it ran at all, and with
 * exactly which string.
 *
 * `src/utils/validators.ts` is deliberately left unmocked. It is pure, and the
 * rules it encodes (what counts as a conventional commit, what is too short)
 * are part of the behaviour under test.
 */

vi.mock('../../src/i18n/index.js', async () =>
  (await import('../helpers/module-mocks.js')).i18nMock());

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

vi.mock('../../src/utils/error-mapper.js', async () =>
  (await import('../helpers/module-mocks.js')).errorMapperMock());

vi.mock('../../src/utils/level-helper.js', () => ({
  shouldConfirm: vi.fn(() => true),
  shouldShowWarning: vi.fn(() => true),
  shouldShowExplanation: vi.fn(() => false),
  isLevel: vi.fn(() => false)
}));

vi.mock('../../src/services/git-service.js', () => ({
  gitService: {
    hasConflicts: vi.fn(),
    getConflictedFiles: vi.fn(),
    getStagedFiles: vi.fn(),
    getDiff: vi.fn(),
    commit: vi.fn()
  }
}));

vi.mock('../../src/services/prevention-service.js', () => ({
  preventionService: {
    validateCommit: vi.fn(),
    checkRiskyStagedFiles: vi.fn()
  }
}));

vi.mock('../../src/services/ai/index.js', () => ({
  aiService: {
    isAvailable: vi.fn(),
    generateCommitMessage: vi.fn(),
    summarizeStagedDiff: vi.fn()
  }
}));

vi.mock('../../src/config/user-config.js', () => ({
  userConfig: {
    getAutoGenerateCommitMessages: vi.fn(),
    getExperienceLevel: vi.fn(),
    incrementErrorsPrevented: vi.fn(),
    incrementTotalCommits: vi.fn(),
    incrementAiCommitsGenerated: vi.fn()
  }
}));

// Loaded on demand by the menu, so they are mocked by the path it imports.
vi.mock('../../src/ui/menus/setup-menu.js', () => ({
  ensureGitIdentity: vi.fn()
}));

vi.mock('../../src/ui/menus/conflict-resolution-menu.js', () => ({
  showConflictResolutionMenu: vi.fn()
}));

vi.mock('../../src/ui/flows/amend.js', () => ({
  runAmendFlow: vi.fn()
}));

import { showCommitMenu } from '../../src/ui/menus/commit-menu.js';
import { gitService } from '../../src/services/git-service.js';
import { preventionService } from '../../src/services/prevention-service.js';
import { aiService } from '../../src/services/ai/index.js';
import { userConfig } from '../../src/config/user-config.js';
import { ensureGitIdentity } from '../../src/ui/menus/setup-menu.js';
import { showConflictResolutionMenu } from '../../src/ui/menus/conflict-resolution-menu.js';
import { runAmendFlow } from '../../src/ui/flows/amend.js';
import { promptInput, promptConfirm, promptSelect } from '../../src/ui/components/prompt.js';
import { shouldConfirm, isLevel } from '../../src/utils/level-helper.js';

const git = gitService as Mocked<typeof gitService>;
const prevention = preventionService as Mocked<typeof preventionService>;
const ai = aiService as Mocked<typeof aiService>;
const config = userConfig as Mocked<typeof userConfig>;
const identity = ensureGitIdentity as MockedFunction<typeof ensureGitIdentity>;
const resolveConflicts = showConflictResolutionMenu as MockedFunction<
  typeof showConflictResolutionMenu
>;
const amend = runAmendFlow as MockedFunction<typeof runAmendFlow>;
const select = promptSelect as MockedFunction<typeof promptSelect>;
const confirm = promptConfirm as MockedFunction<typeof promptConfirm>;
const input = promptInput as MockedFunction<typeof promptInput>;
const confirmsAtLevel = shouldConfirm as MockedFunction<typeof shouldConfirm>;
const atLevel = isLevel as MockedFunction<typeof isLevel>;

const ok = { valid: true, warnings: [], canProceed: true };

describe('Commit menu', () => {
  beforeEach(() => {
    // reset, not clear: clearAllMocks leaves implementations behind, so a
    // rejection queued by one test would leak into the next.
    vi.resetAllMocks();
    confirmsAtLevel.mockReturnValue(true);
    atLevel.mockReturnValue(false);
    git.hasConflicts.mockResolvedValue(false);
    git.getConflictedFiles.mockResolvedValue([]);
    git.getStagedFiles.mockResolvedValue(['src/app.ts']);
    git.getDiff.mockResolvedValue('diff --git a/src/app.ts');
    git.commit.mockResolvedValue('abc1234');
    identity.mockResolvedValue(true);
    prevention.validateCommit.mockResolvedValue(ok);
    prevention.checkRiskyStagedFiles.mockResolvedValue([]);
    ai.isAvailable.mockResolvedValue(false);
    config.getAutoGenerateCommitMessages.mockReturnValue(false);
    config.getExperienceLevel.mockReturnValue('beginner');
    confirm.mockResolvedValue(true);
    input.mockResolvedValue('a real message');
  });

  describe('the ordinary commit', () => {
    it('should commit the message the user typed', async () => {
      const result = await showCommitMenu();

      expect(git.commit).toHaveBeenCalledWith('a real message');
      expect(result).toEqual({
        committed: true,
        hash: 'abc1234',
        message: 'a real message'
      });
    });

    it('should count the commit', async () => {
      await showCommitMenu();

      expect(config.incrementTotalCommits).toHaveBeenCalledTimes(1);
    });

    it('should not commit when the message is left empty', async () => {
      input.mockResolvedValue('');

      const result = await showCommitMenu();

      expect(git.commit).not.toHaveBeenCalled();
      expect(result.committed).toBe(false);
    });

    it('should not commit when the user declines the final confirmation', async () => {
      confirm.mockResolvedValue(false);

      const result = await showCommitMenu();

      expect(git.commit).not.toHaveBeenCalled();
      expect(result.committed).toBe(false);
    });

    it('should reject a message too short to mean anything', async () => {
      await showCommitMenu();

      const validate = input.mock.calls[0][2] as (value: string) => string | true;
      expect(validate('ab')).not.toBe(true);
      expect(validate('a real message')).toBe(true);
      // Empty is how the user cancels, so it must pass the validator.
      expect(validate('')).toBe(true);
    });

    it('should report failure rather than throw when git refuses the commit', async () => {
      git.commit.mockRejectedValue(new Error('nothing added to commit'));

      const result = await showCommitMenu();

      expect(result.committed).toBe(false);
    });
  });

  describe('refusing to commit', () => {
    it('should not commit while conflicts are unresolved', async () => {
      git.hasConflicts.mockResolvedValue(true);
      git.getConflictedFiles.mockResolvedValue(['src/app.ts']);
      resolveConflicts.mockResolvedValue({ resolved: false } as never);

      const result = await showCommitMenu();

      expect(resolveConflicts).toHaveBeenCalledTimes(1);
      expect(git.commit).not.toHaveBeenCalled();
      expect(result.committed).toBe(false);
    });

    it('should carry on once the conflicts are resolved', async () => {
      git.hasConflicts.mockResolvedValue(true);
      git.getConflictedFiles.mockResolvedValue(['src/app.ts']);
      resolveConflicts.mockResolvedValue({ resolved: true } as never);

      const result = await showCommitMenu();

      expect(git.commit).toHaveBeenCalledWith('a real message');
      expect(result.committed).toBe(true);
    });

    it('should not commit without a git identity', async () => {
      identity.mockResolvedValue(false);

      const result = await showCommitMenu();

      expect(git.commit).not.toHaveBeenCalled();
      expect(result.committed).toBe(false);
    });

    it('should not commit when prevention says it cannot proceed', async () => {
      prevention.validateCommit.mockResolvedValue({
        valid: false,
        canProceed: false,
        warnings: [
          { level: 'critical', title: 'errors.title', message: 'nothing staged', action: 'stage' }
        ]
      });

      const result = await showCommitMenu();

      expect(git.commit).not.toHaveBeenCalled();
      expect(result.committed).toBe(false);
    });
  });

  describe('staged files that look risky', () => {
    const secret = {
      level: 'critical' as const,
      title: 'warnings.title',
      message: '.env is staged',
      action: 'unstage it'
    };

    it('should ask before committing, and default to no', async () => {
      prevention.checkRiskyStagedFiles.mockResolvedValue([secret]);

      await showCommitMenu();

      expect(confirm.mock.calls[0][1]).toBe(false);
    });

    it('should not commit when the user backs out, and count it as prevented', async () => {
      prevention.checkRiskyStagedFiles.mockResolvedValue([secret]);
      confirm.mockResolvedValueOnce(false);

      const result = await showCommitMenu();

      expect(git.commit).not.toHaveBeenCalled();
      expect(config.incrementErrorsPrevented).toHaveBeenCalledTimes(1);
      expect(result.committed).toBe(false);
    });

    it('should commit when the user insists', async () => {
      prevention.checkRiskyStagedFiles.mockResolvedValue([secret]);

      const result = await showCommitMenu();

      expect(git.commit).toHaveBeenCalledWith('a real message');
      expect(config.incrementErrorsPrevented).not.toHaveBeenCalled();
      expect(result.committed).toBe(true);
    });

    it('should not ask at all when nothing staged is risky', async () => {
      await showCommitMenu();

      // Only the final confirmation and the post-commit amend offer.
      expect(confirm).toHaveBeenCalledTimes(2);
    });
  });

  describe('AI-generated messages', () => {
    beforeEach(() => {
      ai.isAvailable.mockResolvedValue(true);
      config.getAutoGenerateCommitMessages.mockReturnValue(true);
      ai.summarizeStagedDiff.mockResolvedValue('touches the app entry point');
      ai.generateCommitMessage.mockResolvedValue({
        success: true,
        message: 'feat: add the app entry point'
      } as never);
    });

    it('should commit the suggestion once the user accepts it', async () => {
      const result = await showCommitMenu();

      expect(git.commit).toHaveBeenCalledWith('feat: add the app entry point');
      expect(config.incrementAiCommitsGenerated).toHaveBeenCalledTimes(1);
      expect(result.message).toBe('feat: add the app entry point');
    });

    it('should fall back to a typed message when the user rejects the suggestion', async () => {
      // yes to "generate?", no to "use it?", yes to the final confirmation.
      confirm
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);

      await showCommitMenu();

      expect(git.commit).toHaveBeenCalledWith('a real message');
      expect(config.incrementAiCommitsGenerated).not.toHaveBeenCalled();
    });

    it('should fall back to a typed message when generation fails', async () => {
      ai.generateCommitMessage.mockResolvedValue({ success: false } as never);

      await showCommitMenu();

      expect(git.commit).toHaveBeenCalledWith('a real message');
      expect(config.incrementAiCommitsGenerated).not.toHaveBeenCalled();
    });

    it('should survive an AI provider that throws', async () => {
      ai.generateCommitMessage.mockRejectedValue(new Error('copilot exited 1'));

      const result = await showCommitMenu();

      expect(git.commit).toHaveBeenCalledWith('a real message');
      expect(result.committed).toBe(true);
    });

    it('should not ask the AI at all when the user has turned generation off', async () => {
      config.getAutoGenerateCommitMessages.mockReturnValue(false);

      await showCommitMenu();

      expect(ai.generateCommitMessage).not.toHaveBeenCalled();
      expect(git.commit).toHaveBeenCalledWith('a real message');
    });
  });

  describe('the conventional-commit prompt', () => {
    it('should not pester a beginner about it', async () => {
      config.getExperienceLevel.mockReturnValue('beginner');

      await showCommitMenu();

      expect(select).not.toHaveBeenCalled();
      expect(git.commit).toHaveBeenCalledWith('a real message');
    });

    it('should offer a type to an intermediate user and apply the chosen one', async () => {
      config.getExperienceLevel.mockReturnValue('intermediate');
      select.mockResolvedValue('fix' as never);

      await showCommitMenu();

      expect(git.commit).toHaveBeenCalledWith('fix: a real message');
    });

    it('should leave the message alone when the user keeps it as is', async () => {
      config.getExperienceLevel.mockReturnValue('intermediate');
      select.mockResolvedValue('keep' as never);

      await showCommitMenu();

      expect(git.commit).toHaveBeenCalledWith('a real message');
    });

    it('should not offer to convert a message that already conforms', async () => {
      config.getExperienceLevel.mockReturnValue('intermediate');
      input.mockResolvedValue('fix(api): handle an empty body');

      await showCommitMenu();

      expect(select).not.toHaveBeenCalled();
      expect(git.commit).toHaveBeenCalledWith('fix(api): handle an empty body');
    });
  });

  describe('expert mode', () => {
    beforeEach(() => {
      atLevel.mockImplementation(level => level === 'expert');
      config.getExperienceLevel.mockReturnValue('expert');
    });

    it('should not commit when the expert backs out of the action menu', async () => {
      select.mockResolvedValue('back' as never);

      const result = await showCommitMenu();

      expect(git.commit).not.toHaveBeenCalled();
      expect(result.committed).toBe(false);
    });

    it('should not offer the AI entry when no provider is available', async () => {
      select.mockResolvedValue('back' as never);

      await showCommitMenu();

      const offered = (select.mock.calls[0][1] as { value: string }[]).map(c => c.value);
      expect(offered).toEqual(['manual', 'back']);
    });

    it('should offer the AI entry when a provider is available and wanted', async () => {
      ai.isAvailable.mockResolvedValue(true);
      config.getAutoGenerateCommitMessages.mockReturnValue(true);
      ai.summarizeStagedDiff.mockResolvedValue('');
      select.mockResolvedValue('back' as never);

      await showCommitMenu();

      const offered = (select.mock.calls[0][1] as { value: string }[]).map(c => c.value);
      expect(offered).toEqual(['ai', 'manual', 'back']);
    });

    it('should not offer an expert the amend shortcut after committing', async () => {
      select.mockResolvedValueOnce('manual' as never).mockResolvedValue('keep' as never);

      await showCommitMenu();

      expect(git.commit).toHaveBeenCalledWith('a real message');
      expect(amend).not.toHaveBeenCalled();
    });
  });

  describe('the amend shortcut offered after committing', () => {
    it('should default to no and stay out of the way when declined', async () => {
      // Confirm the commit, decline the amend offer that follows it.
      confirm.mockResolvedValueOnce(true).mockResolvedValue(false);

      const result = await showCommitMenu();

      const amendOffer = confirm.mock.calls.at(-1);
      expect(amendOffer?.[1]).toBe(false);
      expect(amend).not.toHaveBeenCalled();
      expect(result.committed).toBe(true);
    });

    it('should run the amend flow when the user takes it', async () => {
      confirm.mockResolvedValue(true);

      await showCommitMenu();

      expect(amend).toHaveBeenCalledTimes(1);
    });
  });
});
