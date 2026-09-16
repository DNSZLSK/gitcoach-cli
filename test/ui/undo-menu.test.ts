import type { Mocked, MockedFunction } from 'vitest';

/**
 * Behaviour tests for the real undo menu.
 *
 * This is the menu that can destroy work: `reset --hard` drops commits,
 * `restore` throws away edits that were never committed anywhere. Every test
 * here is about the gate in front of those two — how many times the user is
 * asked, what the answer defaults to, and that a single "no" anywhere leaves
 * the repository untouched.
 *
 * The distinction the menu draws between destructive and reversible matters
 * too, so the soft reset and the unstage are checked for *not* being gated the
 * same way: a tool that asks twice for everything trains people to say yes.
 */

vi.mock('../../src/i18n/index.js', async () =>
  (await import('../helpers/module-mocks.js')).i18nMock());

vi.mock('../../src/utils/logger.js', async () =>
  (await import('../helpers/module-mocks.js')).loggerMock());

vi.mock('../../src/ui/themes/index.js', async () =>
  (await import('../helpers/module-mocks.js')).themeMock());

vi.mock('../../src/ui/components/box.js', async () =>
  (await import('../helpers/module-mocks.js')).boxMock());

vi.mock('../../src/ui/components/prompt.js', async () =>
  (await import('../helpers/module-mocks.js')).promptMock());

vi.mock('../../src/utils/error-mapper.js', async () =>
  (await import('../helpers/module-mocks.js')).errorMapperMock());

vi.mock('../../src/utils/level-helper.js', () => ({
  shouldConfirm: vi.fn(() => true),
  shouldShowExplanation: vi.fn(() => false)
}));

vi.mock('../../src/services/git-service.js', () => ({
  gitService: {
    getLog: vi.fn(),
    getStatus: vi.fn(),
    getStagedFiles: vi.fn(),
    reset: vi.fn(),
    checkout: vi.fn(),
    revertCommit: vi.fn(),
    hasConflicts: vi.fn()
  }
}));

vi.mock('../../src/ui/menus/recovery-menu.js', () => ({
  showRecoveryMenu: vi.fn()
}));

vi.mock('../../src/ui/flows/amend.js', () => ({
  runAmendFlow: vi.fn()
}));

import { showUndoMenu } from '../../src/ui/menus/undo-menu.js';
import { gitService } from '../../src/services/git-service.js';
import { showRecoveryMenu } from '../../src/ui/menus/recovery-menu.js';
import { runAmendFlow } from '../../src/ui/flows/amend.js';
import { promptSelect, promptConfirm, promptCheckbox } from '../../src/ui/components/prompt.js';
import { shouldConfirm } from '../../src/utils/level-helper.js';

const git = gitService as Mocked<typeof gitService>;
const recovery = showRecoveryMenu as MockedFunction<typeof showRecoveryMenu>;
const amend = runAmendFlow as MockedFunction<typeof runAmendFlow>;
const select = promptSelect as MockedFunction<typeof promptSelect>;
const confirm = promptConfirm as MockedFunction<typeof promptConfirm>;
const checkbox = promptCheckbox as MockedFunction<typeof promptCheckbox>;
const confirmsAtLevel = shouldConfirm as MockedFunction<typeof shouldConfirm>;

const commit = (hash: string, message: string) => ({
  hash,
  message,
  author: 'Someone',
  date: '2026-01-01',
  refs: ''
});

const status = (overrides: Record<string, unknown> = {}) => ({
  isClean: false,
  current: 'main',
  tracking: 'origin/main',
  staged: [],
  modified: ['src/app.ts'],
  deleted: [],
  untracked: [],
  ahead: 0,
  behind: 0,
  ...overrides
});

/** Pick an entry from the top-level undo menu. */
const choose = (action: string) => select.mockResolvedValueOnce(action as never);

describe('Undo menu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    confirmsAtLevel.mockReturnValue(true);
    git.getLog.mockResolvedValue([commit('abc1234def', 'the last commit')]);
    git.getStatus.mockResolvedValue(status());
    git.getStagedFiles.mockResolvedValue(['src/app.ts']);
    git.hasConflicts.mockResolvedValue(false);
    confirm.mockResolvedValue(true);
    checkbox.mockResolvedValue([]);
  });

  it('should touch nothing when the user goes back', async () => {
    choose('back');

    await showUndoMenu();

    expect(git.reset).not.toHaveBeenCalled();
    expect(git.checkout).not.toHaveBeenCalled();
    expect(git.revertCommit).not.toHaveBeenCalled();
  });

  it('should route each entry to its own handler', async () => {
    choose('amend');
    await showUndoMenu();
    expect(amend).toHaveBeenCalledTimes(1);

    choose('recover');
    await showUndoMenu();
    expect(recovery).toHaveBeenCalledTimes(1);
  });

  it('should mark the separator as unselectable', async () => {
    choose('back');

    await showUndoMenu();

    const choices = select.mock.calls[0][1] as { value: string; disabled?: boolean }[];
    const separator = choices.find(c => c.value === 'separator');
    expect(separator?.disabled).toBe(true);
  });

  describe('hard reset', () => {
    it('should ask twice, defaulting to no both times, before dropping a commit', async () => {
      choose('hard_reset');

      await showUndoMenu();

      expect(confirm).toHaveBeenCalledTimes(2);
      expect(confirm.mock.calls[0][1]).toBe(false);
      expect(confirm.mock.calls[1][1]).toBe(false);
      expect(git.reset).toHaveBeenCalledWith('hard', 'HEAD~1');
    });

    it('should stop at the first refusal', async () => {
      choose('hard_reset');
      confirm.mockResolvedValueOnce(false);

      await showUndoMenu();

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(git.reset).not.toHaveBeenCalled();
    });

    it('should stop at the second refusal', async () => {
      choose('hard_reset');
      confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      await showUndoMenu();

      expect(confirm).toHaveBeenCalledTimes(2);
      expect(git.reset).not.toHaveBeenCalled();
    });

    it('should not ask at all when there is no commit to drop', async () => {
      choose('hard_reset');
      git.getLog.mockResolvedValue([]);

      await showUndoMenu();

      expect(confirm).not.toHaveBeenCalled();
      expect(git.reset).not.toHaveBeenCalled();
    });

    it('should keep asking twice even for an expert', async () => {
      // The level helper governs reversible actions; a hard reset is not one.
      confirmsAtLevel.mockReturnValue(false);
      choose('hard_reset');

      await showUndoMenu();

      expect(confirm).toHaveBeenCalledTimes(2);
    });

    it('should report the error rather than throw when git refuses', async () => {
      choose('hard_reset');
      git.reset.mockRejectedValue(new Error('cannot reset'));

      await expect(showUndoMenu()).resolves.toBeUndefined();
    });
  });

  describe('soft reset', () => {
    it('should keep the files and ask only once', async () => {
      choose('soft_reset');

      await showUndoMenu();

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(confirm.mock.calls[0][1]).toBe(false);
      expect(git.reset).toHaveBeenCalledWith('soft', 'HEAD~1');
    });

    it('should not reset when the user declines', async () => {
      choose('soft_reset');
      confirm.mockResolvedValue(false);

      await showUndoMenu();

      expect(git.reset).not.toHaveBeenCalled();
    });

    it('should skip the question for an expert, because nothing is lost', async () => {
      confirmsAtLevel.mockReturnValue(false);
      choose('soft_reset');

      await showUndoMenu();

      expect(confirm).not.toHaveBeenCalled();
      expect(git.reset).toHaveBeenCalledWith('soft', 'HEAD~1');
    });

    it('should do nothing when there are no commits', async () => {
      choose('soft_reset');
      git.getLog.mockResolvedValue([]);

      await showUndoMenu();

      expect(git.reset).not.toHaveBeenCalled();
    });
  });

  describe('restoring modified files', () => {
    it('should discard only the files picked, and only after confirmation', async () => {
      choose('restore');
      git.getStatus.mockResolvedValue(status({ modified: ['a.ts', 'b.ts'], deleted: ['c.ts'] }));
      checkbox.mockResolvedValue(['a.ts', 'c.ts']);

      await showUndoMenu();

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(confirm.mock.calls[0][1]).toBe(false);
      expect(git.checkout).toHaveBeenCalledTimes(2);
      expect(git.checkout).toHaveBeenCalledWith('a.ts');
      expect(git.checkout).toHaveBeenCalledWith('c.ts');
      expect(git.checkout).not.toHaveBeenCalledWith('b.ts');
    });

    it('should offer deleted files alongside modified ones', async () => {
      choose('restore');
      git.getStatus.mockResolvedValue(status({ modified: ['a.ts'], deleted: ['gone.ts'] }));

      await showUndoMenu();

      const offered = (checkbox.mock.calls[0][1] as { value: string }[]).map(c => c.value);
      expect(offered).toEqual(['a.ts', 'gone.ts']);
    });

    it('should leave every box unchecked, so nothing is discarded by reflex', async () => {
      choose('restore');
      git.getStatus.mockResolvedValue(status({ modified: ['a.ts', 'b.ts'] }));

      await showUndoMenu();

      const offered = checkbox.mock.calls[0][1] as { checked: boolean }[];
      expect(offered.every(c => c.checked === false)).toBe(true);
    });

    it('should discard nothing when the user declines the confirmation', async () => {
      choose('restore');
      checkbox.mockResolvedValue(['src/app.ts']);
      confirm.mockResolvedValue(false);

      await showUndoMenu();

      expect(git.checkout).not.toHaveBeenCalled();
    });

    it('should not even ask when no file is picked', async () => {
      choose('restore');
      checkbox.mockResolvedValue([]);

      await showUndoMenu();

      expect(confirm).not.toHaveBeenCalled();
      expect(git.checkout).not.toHaveBeenCalled();
    });

    it('should do nothing when there is nothing modified', async () => {
      choose('restore');
      git.getStatus.mockResolvedValue(status({ modified: [], deleted: [] }));

      await showUndoMenu();

      expect(checkbox).not.toHaveBeenCalled();
      expect(git.checkout).not.toHaveBeenCalled();
    });
  });

  describe('unstaging', () => {
    it('should unstage only the files picked, without asking to confirm', async () => {
      choose('unstage');
      git.getStagedFiles.mockResolvedValue(['a.ts', 'b.ts']);
      checkbox.mockResolvedValue(['b.ts']);

      await showUndoMenu();

      // Unstaging loses no work, so it is not gated behind a question.
      expect(confirm).not.toHaveBeenCalled();
      expect(git.reset).toHaveBeenCalledTimes(1);
      expect(git.reset).toHaveBeenCalledWith('mixed', 'HEAD -- b.ts');
    });

    it('should do nothing when no file is picked', async () => {
      choose('unstage');
      checkbox.mockResolvedValue([]);

      await showUndoMenu();

      expect(git.reset).not.toHaveBeenCalled();
    });

    it('should do nothing when nothing is staged', async () => {
      choose('unstage');
      git.getStagedFiles.mockResolvedValue([]);

      await showUndoMenu();

      expect(checkbox).not.toHaveBeenCalled();
      expect(git.reset).not.toHaveBeenCalled();
    });
  });

  describe('reverting', () => {
    beforeEach(() => {
      git.getLog.mockResolvedValue([
        commit('aaaaaaa1111', 'first subject\n\nbody'),
        commit('bbbbbbb2222', 'second subject')
      ]);
    });

    it('should revert the commit the user picked', async () => {
      choose('revert');
      select.mockResolvedValueOnce('bbbbbbb2222' as never);

      await showUndoMenu();

      expect(git.revertCommit).toHaveBeenCalledWith('bbbbbbb2222');
    });

    it('should offer a way out that reverts nothing', async () => {
      choose('revert');
      select.mockResolvedValueOnce('' as never);

      await showUndoMenu();

      const offered = (select.mock.calls[1][1] as { value: string }[]).map(c => c.value);
      expect(offered.at(-1)).toBe('');
      expect(confirm).not.toHaveBeenCalled();
      expect(git.revertCommit).not.toHaveBeenCalled();
    });

    it('should show only the subject line of a multi-line message', async () => {
      choose('revert');
      select.mockResolvedValueOnce('' as never);

      await showUndoMenu();

      const offered = (select.mock.calls[1][1] as { name: string }[]).map(c => c.name);
      expect(offered[0]).toBe('aaaaaaa  first subject');
    });

    it('should not revert when the confirmation is declined', async () => {
      choose('revert');
      select.mockResolvedValueOnce('aaaaaaa1111' as never);
      confirm.mockResolvedValue(false);

      await showUndoMenu();

      expect(confirm.mock.calls[0][1]).toBe(false);
      expect(git.revertCommit).not.toHaveBeenCalled();
    });

    it('should do nothing when there is no history to revert', async () => {
      choose('revert');
      git.getLog.mockResolvedValue([]);

      await showUndoMenu();

      expect(select).toHaveBeenCalledTimes(1);
      expect(git.revertCommit).not.toHaveBeenCalled();
    });

    it('should name the conflict when a revert stops on one', async () => {
      choose('revert');
      select.mockResolvedValueOnce('aaaaaaa1111' as never);
      git.revertCommit.mockRejectedValue(new Error('revert failed'));
      git.hasConflicts.mockResolvedValue(true);

      await expect(showUndoMenu()).resolves.toBeUndefined();
      expect(git.hasConflicts).toHaveBeenCalled();
    });

    it('should report an ordinary failure rather than throw', async () => {
      choose('revert');
      select.mockResolvedValueOnce('aaaaaaa1111' as never);
      git.revertCommit.mockRejectedValue(new Error('bad object'));
      git.hasConflicts.mockResolvedValue(false);

      await expect(showUndoMenu()).resolves.toBeUndefined();
    });
  });
});
