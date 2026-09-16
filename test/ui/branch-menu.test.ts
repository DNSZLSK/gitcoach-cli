import type { Mocked, MockedFunction } from 'vitest';

/**
 * Behaviour tests for the real branch menu.
 *
 * This is the largest menu and the one with the most ways to lose work: a
 * checkout that walks away from uncommitted edits, a delete of the wrong
 * branch, a rebase or squash that rewrites commits other people already have.
 * The tests below are about the guard in front of each, and about the small
 * rules that are easy to break by accident — that the current branch is never
 * offered as a target, that a rebase refuses to start on a dirty tree, that a
 * squash count outside the history is rejected.
 *
 * `src/utils/validators.ts` stays unmocked: what counts as a legal branch name
 * is behaviour, not scaffolding.
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

vi.mock('../../src/ui/components/table.js', () => ({
  branchTable: vi.fn(() => 'branch table'),
  createTable: vi.fn(() => 'table'),
  statusTable: vi.fn(() => 'status table')
}));

vi.mock('../../src/utils/error-mapper.js', async () =>
  (await import('../helpers/module-mocks.js')).errorMapperMock());

vi.mock('../../src/utils/level-helper.js', () => ({
  shouldConfirm: vi.fn(() => true),
  shouldShowWarning: vi.fn(() => true),
  shouldShowExplanation: vi.fn(() => false)
}));

vi.mock('../../src/services/git-service.js', () => ({
  gitService: {
    getCurrentBranch: vi.fn(),
    getLocalBranches: vi.fn(),
    getBranches: vi.fn(),
    createBranch: vi.fn(),
    checkout: vi.fn(),
    deleteBranch: vi.fn(),
    merge: vi.fn(),
    hasConflicts: vi.fn(),
    getConflictedFiles: vi.fn(),
    hasUncommittedChanges: vi.fn(),
    getCommitsAhead: vi.fn(),
    getUnpushedCommitCount: vi.fn(),
    rebaseOnto: vi.fn(),
    getCommitsNotIn: vi.fn(),
    cherryPick: vi.fn(),
    getLog: vi.fn(),
    squashCommits: vi.fn()
  }
}));

vi.mock('../../src/services/prevention-service.js', () => ({
  preventionService: {
    validateCheckout: vi.fn(),
    validateBranchDelete: vi.fn()
  }
}));

vi.mock('../../src/config/user-config.js', () => ({
  userConfig: { incrementErrorsPrevented: vi.fn() }
}));

import { showBranchMenu } from '../../src/ui/menus/branch-menu.js';
import { gitService } from '../../src/services/git-service.js';
import { preventionService } from '../../src/services/prevention-service.js';
import { userConfig } from '../../src/config/user-config.js';
import { promptSelect, promptConfirm, promptInput } from '../../src/ui/components/prompt.js';
import { shouldConfirm, shouldShowWarning } from '../../src/utils/level-helper.js';

const git = gitService as Mocked<typeof gitService>;
const prevention = preventionService as Mocked<typeof preventionService>;
const config = userConfig as Mocked<typeof userConfig>;
const select = promptSelect as MockedFunction<typeof promptSelect>;
const confirm = promptConfirm as MockedFunction<typeof promptConfirm>;
const input = promptInput as MockedFunction<typeof promptInput>;
const confirmsAtLevel = shouldConfirm as MockedFunction<typeof shouldConfirm>;
const warnsAtLevel = shouldShowWarning as MockedFunction<typeof shouldShowWarning>;

const branch = (name: string, current = false) => ({
  name,
  current,
  commit: 'abc1234',
  label: `${name} label`
});

const commit = (hash: string, message: string) => ({
  hash,
  message,
  author: 'Someone',
  date: '2026-01-01',
  refs: ''
});

const clean = { valid: true, warnings: [], canProceed: true };

const dirty = {
  valid: false,
  canProceed: true,
  warnings: [
    {
      level: 'warning' as const,
      title: 'warnings.title',
      message: 'you have uncommitted changes',
      action: 'stash or commit them'
    }
  ]
};

/** Pick an entry from the top-level branch menu. */
const choose = (action: string) => select.mockResolvedValueOnce(action as never);

describe('Branch menu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    confirmsAtLevel.mockReturnValue(true);
    warnsAtLevel.mockReturnValue(true);
    git.getCurrentBranch.mockResolvedValue('main');
    git.getLocalBranches.mockResolvedValue([branch('main', true), branch('feature')]);
    git.getBranches.mockResolvedValue([branch('main', true), branch('feature')]);
    git.hasUncommittedChanges.mockResolvedValue(false);
    git.hasConflicts.mockResolvedValue(false);
    git.getConflictedFiles.mockResolvedValue([]);
    git.getCommitsAhead.mockResolvedValue([commit('aaa1111', 'one')]);
    git.getUnpushedCommitCount.mockResolvedValue(1);
    git.rebaseOnto.mockResolvedValue(true);
    git.getCommitsNotIn.mockResolvedValue([commit('ddd4444', 'a fix worth copying')]);
    git.cherryPick.mockResolvedValue(true);
    git.getLog.mockResolvedValue([commit('aaa1111', 'one'), commit('bbb2222', 'two')]);
    prevention.validateCheckout.mockResolvedValue(clean);
    prevention.validateBranchDelete.mockResolvedValue(clean);
    confirm.mockResolvedValue(true);
    input.mockResolvedValue('');
  });

  it('should do nothing when the user goes back', async () => {
    choose('back');

    const result = await showBranchMenu();

    expect(git.checkout).not.toHaveBeenCalled();
    expect(git.deleteBranch).not.toHaveBeenCalled();
    expect(result).toEqual({ action: 'back', success: true });
  });

  it('should report failure rather than throw when git is unhappy', async () => {
    git.getCurrentBranch.mockRejectedValue(new Error('not a git repository'));

    const result = await showBranchMenu();

    expect(result).toEqual({ action: 'back', success: false });
  });

  describe('creating a branch', () => {
    it('should create the branch and switch to it', async () => {
      choose('create');
      input.mockResolvedValue('feature/login');

      const result = await showBranchMenu();

      expect(git.createBranch).toHaveBeenCalledWith('feature/login', true);
      expect(result).toEqual({ action: 'create', branch: 'feature/login', success: true });
    });

    it('should not create a branch whose name is already taken', async () => {
      choose('create');
      input.mockResolvedValue('feature');

      const result = await showBranchMenu();

      expect(git.createBranch).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should not create anything when no name is given', async () => {
      choose('create');
      input.mockResolvedValue('');

      const result = await showBranchMenu();

      expect(git.createBranch).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should reject a name git would refuse', async () => {
      choose('create');
      input.mockResolvedValue('ok-name');

      await showBranchMenu();

      const validate = input.mock.calls[0][2] as (value: string) => string | true;
      expect(validate('ok-name')).toBe(true);
      expect(validate('has spaces')).not.toBe(true);
      expect(validate('..')).not.toBe(true);
      expect(validate('')).not.toBe(true);
    });
  });

  describe('switching branch', () => {
    it('should check out the branch the user picked', async () => {
      choose('switch');
      select.mockResolvedValue('feature' as never);

      const result = await showBranchMenu();

      expect(git.checkout).toHaveBeenCalledWith('feature');
      expect(result).toEqual({ action: 'switch', branch: 'feature', success: true });
    });

    it('should never offer the branch already checked out', async () => {
      choose('switch');
      git.getLocalBranches.mockResolvedValue([
        branch('main', true),
        branch('feature'),
        branch('hotfix')
      ]);
      select.mockResolvedValue('feature' as never);

      await showBranchMenu();

      const offered = (select.mock.calls[1][1] as { value: string }[]).map(c => c.value);
      expect(offered).toEqual(['feature', 'hotfix']);
    });

    it('should do nothing when there is nowhere else to go', async () => {
      choose('switch');
      git.getLocalBranches.mockResolvedValue([branch('main', true)]);

      const result = await showBranchMenu();

      expect(git.checkout).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should ask before walking away from uncommitted changes', async () => {
      choose('switch');
      select.mockResolvedValue('feature' as never);
      prevention.validateCheckout.mockResolvedValue(dirty);

      await showBranchMenu();

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(confirm.mock.calls[0][1]).toBe(false);
      expect(git.checkout).toHaveBeenCalledWith('feature');
    });

    it('should not check out when the user backs out of that question', async () => {
      choose('switch');
      select.mockResolvedValue('feature' as never);
      prevention.validateCheckout.mockResolvedValue(dirty);
      confirm.mockResolvedValue(false);

      const result = await showBranchMenu();

      expect(git.checkout).not.toHaveBeenCalled();
      expect(config.incrementErrorsPrevented).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(false);
    });

    it('should refuse outright when prevention says it cannot proceed', async () => {
      choose('switch');
      select.mockResolvedValue('feature' as never);
      prevention.validateCheckout.mockResolvedValue({ ...dirty, canProceed: false });

      const result = await showBranchMenu();

      expect(confirm).not.toHaveBeenCalled();
      expect(git.checkout).not.toHaveBeenCalled();
      expect(config.incrementErrorsPrevented).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(false);
    });

    it('should not ask when the warning was filtered out for the level', async () => {
      choose('switch');
      select.mockResolvedValue('feature' as never);
      prevention.validateCheckout.mockResolvedValue(dirty);
      // An expert sees only critical warnings; this one is not shown, so
      // stopping to ask about a warning they never saw would be nonsense.
      warnsAtLevel.mockImplementation(category => category === 'critical');

      await showBranchMenu();

      expect(confirm).not.toHaveBeenCalled();
      expect(git.checkout).toHaveBeenCalledWith('feature');
    });
  });

  describe('deleting a branch', () => {
    it('should delete only after an explicit yes, defaulting to no', async () => {
      choose('delete');
      select.mockResolvedValue('feature' as never);

      const result = await showBranchMenu();

      expect(confirm.mock.calls[0][1]).toBe(false);
      expect(git.deleteBranch).toHaveBeenCalledWith('feature');
      expect(result).toEqual({ action: 'delete', branch: 'feature', success: true });
    });

    it('should not delete when the confirmation is declined', async () => {
      choose('delete');
      select.mockResolvedValue('feature' as never);
      confirm.mockResolvedValue(false);

      const result = await showBranchMenu();

      expect(git.deleteBranch).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should never offer the current branch for deletion', async () => {
      choose('delete');
      git.getLocalBranches.mockResolvedValue([branch('main', true), branch('feature')]);
      select.mockResolvedValue('feature' as never);

      await showBranchMenu();

      const offered = (select.mock.calls[1][1] as { value: string }[]).map(c => c.value);
      expect(offered).toEqual(['feature']);
    });

    it('should say so when the current branch is the only one', async () => {
      choose('delete');
      git.getLocalBranches.mockResolvedValue([branch('main', true)]);

      const result = await showBranchMenu();

      expect(git.deleteBranch).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should not even ask when prevention refuses the delete', async () => {
      choose('delete');
      select.mockResolvedValue('feature' as never);
      prevention.validateBranchDelete.mockResolvedValue({
        valid: false,
        canProceed: false,
        warnings: [
          {
            level: 'critical',
            title: 'warnings.title',
            message: 'branch is not merged',
            action: 'merge it first'
          }
        ]
      });

      const result = await showBranchMenu();

      expect(confirm).not.toHaveBeenCalled();
      expect(git.deleteBranch).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });
  });

  describe('merging', () => {
    it('should merge the branch the user picked', async () => {
      choose('merge');
      select.mockResolvedValue('feature' as never);

      const result = await showBranchMenu();

      expect(git.merge).toHaveBeenCalledWith('feature');
      expect(result).toEqual({ action: 'merge', branch: 'feature', success: true });
    });

    it('should not merge when the confirmation is declined', async () => {
      choose('merge');
      select.mockResolvedValue('feature' as never);
      confirm.mockResolvedValue(false);

      const result = await showBranchMenu();

      expect(git.merge).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should report failure when the merge leaves conflicts behind', async () => {
      choose('merge');
      select.mockResolvedValue('feature' as never);
      git.hasConflicts.mockResolvedValue(true);
      git.getConflictedFiles.mockResolvedValue(['src/app.ts']);

      const result = await showBranchMenu();

      expect(result).toEqual({ action: 'merge', branch: 'feature', success: false });
    });

    it('should treat a merge that throws on a conflict the same way', async () => {
      choose('merge');
      select.mockResolvedValue('feature' as never);
      git.merge.mockRejectedValue(new Error('Automatic merge failed'));
      git.hasConflicts.mockResolvedValue(true);
      git.getConflictedFiles.mockResolvedValue(['src/app.ts']);

      const result = await showBranchMenu();

      expect(result.success).toBe(false);
    });

    it('should report a merge failure that is not a conflict', async () => {
      choose('merge');
      select.mockResolvedValue('feature' as never);
      git.merge.mockRejectedValue(new Error('refusing to merge unrelated histories'));
      git.hasConflicts.mockResolvedValue(false);

      const result = await showBranchMenu();

      expect(result).toEqual({ action: 'back', success: false });
    });
  });

  describe('rebasing', () => {
    it('should refuse to start on a dirty tree', async () => {
      choose('rebase');
      git.hasUncommittedChanges.mockResolvedValue(true);

      const result = await showBranchMenu();

      expect(git.rebaseOnto).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should rebase onto the branch the user picked', async () => {
      choose('rebase');
      select.mockResolvedValue('feature' as never);

      const result = await showBranchMenu();

      expect(git.rebaseOnto).toHaveBeenCalledWith('feature');
      expect(result).toEqual({ action: 'rebase', branch: 'feature', success: true });
    });

    it('should offer a way out that rebases nothing', async () => {
      choose('rebase');
      select.mockResolvedValue('' as never);

      const result = await showBranchMenu();

      expect(git.rebaseOnto).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should not rebase when the confirmation is declined', async () => {
      choose('rebase');
      select.mockResolvedValue('feature' as never);
      confirm.mockResolvedValue(false);

      await showBranchMenu();

      expect(confirm.mock.calls[0][1]).toBe(false);
      expect(git.rebaseOnto).not.toHaveBeenCalled();
    });

    it('should do nothing when there is nothing to replay', async () => {
      choose('rebase');
      select.mockResolvedValue('feature' as never);
      git.getCommitsAhead.mockResolvedValue([]);

      await showBranchMenu();

      expect(confirm).not.toHaveBeenCalled();
      expect(git.rebaseOnto).not.toHaveBeenCalled();
    });

    it('should warn when commits that others already have would be rewritten', async () => {
      choose('rebase');
      select.mockResolvedValue('feature' as never);
      git.getCommitsAhead.mockResolvedValue([
        commit('aaa1111', 'one'),
        commit('bbb2222', 'two'),
        commit('ccc3333', 'three')
      ]);
      // Only one of the three is unpushed, so two are already published.
      git.getUnpushedCommitCount.mockResolvedValue(1);

      await showBranchMenu();

      expect(warnsAtLevel).toHaveBeenCalledWith('warning');
      expect(git.rebaseOnto).toHaveBeenCalledWith('feature');
    });

    it('should report the stop when a rebase halts on a conflict', async () => {
      choose('rebase');
      select.mockResolvedValue('feature' as never);
      git.rebaseOnto.mockResolvedValue(false);

      const result = await showBranchMenu();

      expect(result).toEqual({ action: 'rebase', branch: 'feature', success: false });
    });
  });

  describe('squashing', () => {
    beforeEach(() => {
      git.getLog.mockResolvedValue([
        commit('aaa1111', 'one'),
        commit('bbb2222', 'two'),
        commit('ccc3333', 'three')
      ]);
    });

    it('should refuse to start on a dirty tree', async () => {
      choose('squash');
      git.hasUncommittedChanges.mockResolvedValue(true);

      const result = await showBranchMenu();

      expect(git.squashCommits).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should squash the requested number under the given message', async () => {
      choose('squash');
      input.mockResolvedValueOnce('2').mockResolvedValueOnce('feat: one thing');

      const result = await showBranchMenu();

      expect(git.squashCommits).toHaveBeenCalledWith(2, 'feat: one thing');
      expect(result.success).toBe(true);
    });

    it('should not squash when the confirmation is declined', async () => {
      choose('squash');
      input.mockResolvedValueOnce('2').mockResolvedValueOnce('feat: one thing');
      confirm.mockResolvedValue(false);

      await showBranchMenu();

      expect(confirm.mock.calls[0][1]).toBe(false);
      expect(git.squashCommits).not.toHaveBeenCalled();
    });

    it('should not squash without a message', async () => {
      choose('squash');
      input.mockResolvedValueOnce('2').mockResolvedValueOnce('   ');

      const result = await showBranchMenu();

      expect(git.squashCommits).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should need at least two commits to collapse', async () => {
      choose('squash');
      git.getLog.mockResolvedValue([commit('aaa1111', 'one')]);

      const result = await showBranchMenu();

      expect(input).not.toHaveBeenCalled();
      expect(git.squashCommits).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should reject a count outside the history it can reach', async () => {
      choose('squash');
      input.mockResolvedValueOnce('2').mockResolvedValueOnce('feat: one thing');

      await showBranchMenu();

      const validate = input.mock.calls[0][2] as (value: string) => string | true;
      expect(validate('2')).toBe(true);
      expect(validate('3')).toBe(true);
      expect(validate('1')).not.toBe(true);
      expect(validate('4')).not.toBe(true);
      expect(validate('two')).not.toBe(true);
      expect(validate('2.5')).not.toBe(true);
    });

    it('should not squash a count the prompt let through but the code rejects', async () => {
      choose('squash');
      input.mockResolvedValueOnce('99').mockResolvedValueOnce('feat: one thing');

      const result = await showBranchMenu();

      expect(git.squashCommits).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });
  });

  describe('cherry-picking', () => {
    it('should refuse to start on a dirty tree', async () => {
      choose('cherry_pick');
      git.hasUncommittedChanges.mockResolvedValue(true);

      const result = await showBranchMenu();

      expect(git.cherryPick).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should copy the commit the user picked', async () => {
      choose('cherry_pick');
      select.mockResolvedValueOnce('feature' as never).mockResolvedValueOnce('ddd4444' as never);

      const result = await showBranchMenu();

      expect(git.getCommitsNotIn).toHaveBeenCalledWith('feature');
      expect(git.cherryPick).toHaveBeenCalledWith('ddd4444');
      expect(result).toEqual({ action: 'cherry_pick', branch: 'feature', success: true });
    });

    it('should never offer the current branch as a source', async () => {
      choose('cherry_pick');
      git.getLocalBranches.mockResolvedValue([
        branch('main', true),
        branch('feature'),
        branch('hotfix')
      ]);
      select.mockResolvedValue('' as never);

      await showBranchMenu();

      const offered = (select.mock.calls[1][1] as { value: string }[]).map(c => c.value);
      expect(offered).toEqual(['feature', 'hotfix', '']);
    });

    it('should offer a way out at the branch step that copies nothing', async () => {
      choose('cherry_pick');
      select.mockResolvedValueOnce('' as never);

      const result = await showBranchMenu();

      expect(git.getCommitsNotIn).not.toHaveBeenCalled();
      expect(git.cherryPick).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should offer a way out at the commit step that copies nothing', async () => {
      choose('cherry_pick');
      select.mockResolvedValueOnce('feature' as never).mockResolvedValueOnce('' as never);

      const result = await showBranchMenu();

      expect(confirm).not.toHaveBeenCalled();
      expect(git.cherryPick).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should not copy when the confirmation is declined', async () => {
      choose('cherry_pick');
      select.mockResolvedValueOnce('feature' as never).mockResolvedValueOnce('ddd4444' as never);
      confirm.mockResolvedValue(false);

      await showBranchMenu();

      expect(confirm.mock.calls[0][1]).toBe(false);
      expect(git.cherryPick).not.toHaveBeenCalled();
    });

    it('should offer only commits this branch does not already have', async () => {
      choose('cherry_pick');
      git.getCommitsNotIn.mockResolvedValue([
        commit('ddd4444', 'a fix worth copying'),
        commit('eee5555', 'another one')
      ]);
      select.mockResolvedValueOnce('feature' as never).mockResolvedValueOnce('' as never);

      await showBranchMenu();

      const offered = (select.mock.calls[2][1] as { value: string }[]).map(c => c.value);
      expect(offered).toEqual(['ddd4444', 'eee5555', '']);
    });

    it('should say so when the source branch has nothing to give', async () => {
      choose('cherry_pick');
      git.getCommitsNotIn.mockResolvedValue([]);
      select.mockResolvedValueOnce('feature' as never);

      const result = await showBranchMenu();

      expect(confirm).not.toHaveBeenCalled();
      expect(git.cherryPick).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should show only the subject line of a multi-line message', async () => {
      choose('cherry_pick');
      git.getCommitsNotIn.mockResolvedValue([commit('ddd4444', 'the subject\n\nthe body')]);
      select.mockResolvedValueOnce('feature' as never).mockResolvedValueOnce('' as never);

      await showBranchMenu();

      const offered = (select.mock.calls[2][1] as { name: string }[]).map(c => c.name);
      expect(offered[0]).toBe('ddd4444  the subject');
    });

    it('should report the stop when the copy halts on a conflict', async () => {
      choose('cherry_pick');
      select.mockResolvedValueOnce('feature' as never).mockResolvedValueOnce('ddd4444' as never);
      git.cherryPick.mockResolvedValue(false);

      const result = await showBranchMenu();

      expect(result).toEqual({ action: 'cherry_pick', branch: 'feature', success: false });
    });

    it('should do nothing when there is no other branch to take from', async () => {
      choose('cherry_pick');
      git.getLocalBranches.mockResolvedValue([branch('main', true)]);

      const result = await showBranchMenu();

      expect(git.cherryPick).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });
  });

  describe('listing', () => {
    it('should read the branches without changing anything', async () => {
      choose('list');

      const result = await showBranchMenu();

      expect(git.getLocalBranches).toHaveBeenCalledTimes(1);
      expect(git.checkout).not.toHaveBeenCalled();
      expect(git.deleteBranch).not.toHaveBeenCalled();
      expect(result).toEqual({ action: 'list', success: true });
    });
  });
});
