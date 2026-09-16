import type { Mocked, MockedFunction } from 'vitest';

/**
 * Behaviour tests for the real pull menu.
 *
 * A pull is where someone else's work meets yours, so this menu's job is to
 * notice the states where that goes wrong — a merge already half-done,
 * uncommitted edits in the way, a branch that has diverged — and stop instead
 * of running `git pull` into them. The tests assert on `gitService.pull`: when
 * it runs at all, and with which options.
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
  shouldShowExplanation: vi.fn(() => false),
  isLevel: vi.fn(() => false)
}));

vi.mock('../../src/services/git-service.js', () => ({
  gitService: {
    isMergeInProgress: vi.fn(),
    isRebaseInProgress: vi.fn(),
    abortMerge: vi.fn(),
    getRemotes: vi.fn(),
    addRemote: vi.fn(),
    getStatus: vi.fn(),
    hasUpstream: vi.fn(),
    stash: vi.fn(),
    fetch: vi.fn(),
    pull: vi.fn(),
    hasConflicts: vi.fn(),
    getConflictedFiles: vi.fn()
  }
}));

vi.mock('../../src/ui/menus/commit-menu.js', () => ({
  showCommitMenu: vi.fn()
}));

vi.mock('../../src/ui/menus/conflict-resolution-menu.js', () => ({
  showConflictResolutionMenu: vi.fn()
}));

import { showPullMenu } from '../../src/ui/menus/pull-menu.js';
import { gitService } from '../../src/services/git-service.js';
import { showCommitMenu } from '../../src/ui/menus/commit-menu.js';
import { showConflictResolutionMenu } from '../../src/ui/menus/conflict-resolution-menu.js';
import { promptSelect, promptConfirm, promptInput } from '../../src/ui/components/prompt.js';
import { shouldConfirm, isLevel } from '../../src/utils/level-helper.js';

const git = gitService as Mocked<typeof gitService>;
const commitMenu = showCommitMenu as MockedFunction<typeof showCommitMenu>;
const resolveConflicts = showConflictResolutionMenu as MockedFunction<
  typeof showConflictResolutionMenu
>;
const select = promptSelect as MockedFunction<typeof promptSelect>;
const confirm = promptConfirm as MockedFunction<typeof promptConfirm>;
const input = promptInput as MockedFunction<typeof promptInput>;
const confirmsAtLevel = shouldConfirm as MockedFunction<typeof shouldConfirm>;
const atLevel = isLevel as MockedFunction<typeof isLevel>;

const status = (overrides: Record<string, unknown> = {}) => ({
  isClean: true,
  current: 'main',
  tracking: 'origin/main',
  staged: [],
  modified: [],
  deleted: [],
  untracked: [],
  ahead: 0,
  behind: 2,
  ...overrides
});

describe('Pull menu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    confirmsAtLevel.mockReturnValue(true);
    atLevel.mockReturnValue(false);
    git.isMergeInProgress.mockResolvedValue(false);
    git.isRebaseInProgress.mockResolvedValue(false);
    git.getRemotes.mockResolvedValue(['origin']);
    git.getStatus.mockResolvedValue(status());
    git.hasUpstream.mockResolvedValue(true);
    git.hasConflicts.mockResolvedValue(false);
    git.getConflictedFiles.mockResolvedValue([]);
    confirm.mockResolvedValue(true);
    input.mockResolvedValue('');
  });

  describe('the ordinary pull', () => {
    it('should pull the current branch from the remote', async () => {
      const result = await showPullMenu();

      expect(git.pull).toHaveBeenCalledWith('origin', 'main');
      expect(result).toEqual({ pulled: true, remote: 'origin', branch: 'main' });
    });

    it('should not pull when the user declines the confirmation', async () => {
      confirm.mockResolvedValue(false);

      const result = await showPullMenu();

      expect(git.pull).not.toHaveBeenCalled();
      expect(result.pulled).toBe(false);
    });

    it('should not pull when there is nothing to pull', async () => {
      git.getStatus.mockResolvedValue(status({ behind: 0 }));

      const result = await showPullMenu();

      expect(git.pull).not.toHaveBeenCalled();
      expect(result.pulled).toBe(false);
    });

    it('should fetch before deciding what to do', async () => {
      await showPullMenu();

      expect(git.fetch).toHaveBeenCalledWith('origin');
      expect(git.fetch.mock.invocationCallOrder[0]).toBeLessThan(
        git.pull.mock.invocationCallOrder[0]
      );
    });

    it('should carry on when the fetch itself fails', async () => {
      git.fetch.mockRejectedValue(new Error('network unreachable'));

      const result = await showPullMenu();

      expect(git.pull).toHaveBeenCalledTimes(1);
      expect(result.pulled).toBe(true);
    });
  });

  describe('when an operation is already in progress', () => {
    it('should refuse to pull into a half-finished merge', async () => {
      git.isMergeInProgress.mockResolvedValue(true);
      confirm.mockResolvedValue(false);

      const result = await showPullMenu();

      expect(git.pull).not.toHaveBeenCalled();
      expect(git.abortMerge).not.toHaveBeenCalled();
      // It must stop here, not merely fail to pull further down: reaching the
      // fetch would mean the guard was skipped and something else said no.
      expect(git.fetch).not.toHaveBeenCalled();
      expect(result.pulled).toBe(false);
    });

    it('should abort the merge on request, and still not pull', async () => {
      git.isMergeInProgress.mockResolvedValue(true);

      const result = await showPullMenu();

      expect(confirm.mock.calls[0][1]).toBe(false);
      expect(git.abortMerge).toHaveBeenCalledTimes(1);
      expect(git.pull).not.toHaveBeenCalled();
      expect(result.pulled).toBe(false);
    });

    it('should refuse to pull during a rebase, without asking anything', async () => {
      git.isRebaseInProgress.mockResolvedValue(true);

      const result = await showPullMenu();

      expect(confirm).not.toHaveBeenCalled();
      expect(git.pull).not.toHaveBeenCalled();
      expect(result.pulled).toBe(false);
    });
  });

  describe('uncommitted changes in the way', () => {
    beforeEach(() => {
      git.getStatus.mockResolvedValue(status({ isClean: false, modified: ['src/app.ts'] }));
    });

    it('should stash before pulling when asked to', async () => {
      select.mockResolvedValue('stash' as never);

      await showPullMenu();

      expect(git.stash).toHaveBeenCalledWith('Auto-stash before pull');
      expect(git.stash.mock.invocationCallOrder[0]).toBeLessThan(
        git.pull.mock.invocationCallOrder[0]
      );
    });

    it('should pull without stashing when the user chooses to continue', async () => {
      select.mockResolvedValue('continue' as never);

      const result = await showPullMenu();

      expect(git.stash).not.toHaveBeenCalled();
      expect(git.pull).toHaveBeenCalledTimes(1);
      expect(result.pulled).toBe(true);
    });

    it('should hand over to the commit menu and start again', async () => {
      select.mockResolvedValueOnce('commit' as never);
      // The commit menu leaves the tree clean, so the second pass goes through.
      git.getStatus
        .mockResolvedValueOnce(status({ isClean: false, modified: ['src/app.ts'] }))
        .mockResolvedValue(status());

      const result = await showPullMenu();

      expect(commitMenu).toHaveBeenCalledTimes(1);
      expect(git.pull).toHaveBeenCalledTimes(1);
      expect(result.pulled).toBe(true);
    });

    it('should offer stashing before the option that risks the changes', async () => {
      select.mockResolvedValue('continue' as never);

      await showPullMenu();

      const offered = (select.mock.calls[0][1] as { value: string }[]).map(c => c.value);
      expect(offered).toEqual(['commit', 'stash', 'continue']);
    });
  });

  describe('a diverged branch', () => {
    beforeEach(() => {
      git.getStatus.mockResolvedValue(status({ ahead: 2, behind: 3 }));
    });

    it('should not pick merge or rebase on the behalf of the user', async () => {
      select.mockResolvedValue('cancel' as never);

      const result = await showPullMenu();

      expect(select).toHaveBeenCalledTimes(1);
      expect(git.pull).not.toHaveBeenCalled();
      expect(result.pulled).toBe(false);
    });

    it('should pull with --rebase when rebase is chosen', async () => {
      select.mockResolvedValue('rebase' as never);

      const result = await showPullMenu();

      expect(git.pull).toHaveBeenCalledWith('origin', 'main', { '--rebase': null });
      expect(result.pulled).toBe(true);
    });

    it('should fall through to an ordinary merge pull when merge is chosen', async () => {
      select.mockResolvedValue('merge' as never);

      const result = await showPullMenu();

      expect(git.pull).toHaveBeenCalledWith('origin', 'main');
      expect(result.pulled).toBe(true);
    });
  });

  describe('conflicts raised by the pull', () => {
    beforeEach(() => {
      git.pull.mockRejectedValue(new Error('Automatic merge failed'));
      git.hasConflicts.mockResolvedValue(true);
      git.getConflictedFiles.mockResolvedValue(['src/app.ts', 'src/other.ts']);
    });

    it('should abort the merge when asked, leaving nothing half-merged', async () => {
      select.mockResolvedValue('abort' as never);

      const result = await showPullMenu();

      expect(git.abortMerge).toHaveBeenCalledTimes(1);
      expect(result.pulled).toBe(false);
    });

    it('should report success once guided resolution finishes', async () => {
      select.mockResolvedValue('guided' as never);
      resolveConflicts.mockResolvedValue({ resolved: true } as never);

      const result = await showPullMenu();

      expect(resolveConflicts).toHaveBeenCalledTimes(1);
      expect(result.pulled).toBe(true);
    });

    it('should report failure when guided resolution is abandoned', async () => {
      select.mockResolvedValue('guided' as never);
      resolveConflicts.mockResolvedValue({ resolved: false } as never);

      const result = await showPullMenu();

      expect(result.pulled).toBe(false);
    });

    it('should leave the conflicts in place when the user takes them manually', async () => {
      select.mockResolvedValue('manual' as never);

      const result = await showPullMenu();

      expect(git.abortMerge).not.toHaveBeenCalled();
      expect(result.pulled).toBe(false);
    });

    it('should survive an abort that itself fails', async () => {
      select.mockResolvedValue('abort' as never);
      git.abortMerge.mockRejectedValue(new Error('no merge to abort'));

      const result = await showPullMenu();

      expect(result.pulled).toBe(false);
    });

    it('should report a plain failure when the pull failed for another reason', async () => {
      git.hasConflicts.mockResolvedValue(false);

      const result = await showPullMenu();

      expect(select).not.toHaveBeenCalled();
      expect(result.pulled).toBe(false);
    });
  });

  describe('remotes and upstreams', () => {
    it('should not pull when the user declines to add a missing remote', async () => {
      git.getRemotes.mockResolvedValue([]);
      confirm.mockResolvedValueOnce(false);

      const result = await showPullMenu();

      expect(git.addRemote).not.toHaveBeenCalled();
      expect(git.pull).not.toHaveBeenCalled();
      expect(result.pulled).toBe(false);
    });

    it('should add the remote the user gives', async () => {
      git.getRemotes.mockResolvedValue([]);
      input.mockResolvedValueOnce('git@github.com:user/repo.git');

      await showPullMenu();

      expect(git.addRemote).toHaveBeenCalledWith('origin', 'git@github.com:user/repo.git');
    });

    it('should reject an invalid url through the prompt validator', async () => {
      git.getRemotes.mockResolvedValue([]);
      input.mockResolvedValueOnce('git@github.com:user/repo.git');

      await showPullMenu();

      const validate = input.mock.calls[0][2] as (value: string) => string | true;
      expect(validate('')).not.toBe(true);
      expect(validate('nonsense')).not.toBe(true);
      expect(validate('git@github.com:user/repo.git')).toBe(true);
    });

    it('should ask which remote to use when there is more than one', async () => {
      git.getRemotes.mockResolvedValue(['origin', 'upstream']);
      select.mockResolvedValue('upstream' as never);

      await showPullMenu();

      expect(git.fetch).toHaveBeenCalledWith('upstream');
      expect(git.pull).toHaveBeenCalledWith('upstream', 'main');
    });

    it('should not pull when the user refuses to set an upstream', async () => {
      git.hasUpstream.mockResolvedValue(false);
      confirm.mockResolvedValueOnce(false);

      const result = await showPullMenu();

      expect(git.pull).not.toHaveBeenCalled();
      expect(result.pulled).toBe(false);
    });
  });

  describe('expert mode', () => {
    beforeEach(() => {
      atLevel.mockImplementation(level => level === 'expert');
    });

    it('should not pull when the expert backs out of the action menu', async () => {
      select.mockResolvedValue('back' as never);

      const result = await showPullMenu();

      expect(git.pull).not.toHaveBeenCalled();
      expect(result.pulled).toBe(false);
    });

    it('should pull when the expert confirms the action', async () => {
      select.mockResolvedValue('pull' as never);
      confirmsAtLevel.mockReturnValue(false);

      const result = await showPullMenu();

      expect(confirm).not.toHaveBeenCalled();
      expect(git.pull).toHaveBeenCalledTimes(1);
      expect(result.pulled).toBe(true);
    });
  });
});
