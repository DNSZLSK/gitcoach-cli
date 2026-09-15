/**
 * Behaviour tests for the interrupted-operation flow, driving the real module.
 *
 * The subtle part is that success must never be announced on the strength of
 * an absent exception: simple-git resolves even when git refuses to continue.
 * These tests pin that down, along with which exits are offered in each state.
 */

jest.mock('../../src/i18n/index.js', () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key
}));

jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    raw: jest.fn(),
    command: jest.fn()
  }
}));

jest.mock('../../src/ui/themes/index.js', () => ({
  getTheme: () => new Proxy({}, { get: () => (value: string) => String(value) })
}));

jest.mock('../../src/ui/components/box.js', () => ({
  successBox: (text: string) => text,
  warningBox: (text: string) => text,
  infoBox: (text: string) => text,
  errorBox: (text: string) => text
}));

jest.mock('../../src/utils/error-mapper.js', () => ({
  mapGitError: (error: unknown) => String(error)
}));

jest.mock('../../src/utils/level-helper.js', () => ({
  shouldShowExplanation: () => false
}));

jest.mock('../../src/ui/components/prompt.js', () => ({
  promptSelect: jest.fn(),
  promptConfirm: jest.fn(),
  promptInput: jest.fn()
}));

jest.mock('../../src/services/git-service.js', () => ({
  gitService: {
    isRebaseInProgress: jest.fn(),
    isCherryPickInProgress: jest.fn(),
    isMergeInProgress: jest.fn(),
    isBisectInProgress: jest.fn(),
    getRebaseProgress: jest.fn(),
    getConflictedFiles: jest.fn(),
    hasConflicts: jest.fn(),
    continueRebase: jest.fn(),
    continueCherryPick: jest.fn(),
    commitNoEdit: jest.fn(),
    skipRebase: jest.fn(),
    abortRebase: jest.fn(),
    abortCherryPick: jest.fn(),
    abortMerge: jest.fn(),
    abortBisect: jest.fn()
  }
}));

import { detectInProgress, runInProgressFlow } from '../../src/ui/flows/in-progress.js';
import { gitService } from '../../src/services/git-service.js';
import { promptSelect } from '../../src/ui/components/prompt.js';
import { logger } from '../../src/utils/logger.js';

const git = gitService as jest.Mocked<typeof gitService>;
const select = promptSelect as jest.MockedFunction<typeof promptSelect>;

const offeredValues = () =>
  (select.mock.calls[0][1] as { value: string }[]).map(choice => choice.value);

describe('Interrupted operation flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    git.isRebaseInProgress.mockResolvedValue(false);
    git.isCherryPickInProgress.mockResolvedValue(false);
    git.isMergeInProgress.mockResolvedValue(false);
    git.isBisectInProgress.mockResolvedValue(false);
    git.getRebaseProgress.mockResolvedValue(null);
    git.getConflictedFiles.mockResolvedValue([]);
    git.hasConflicts.mockResolvedValue(false);
  });

  describe('detection', () => {
    it('should report nothing when the repository is idle', async () => {
      await expect(detectInProgress()).resolves.toBeNull();
    });

    it('should report a rebase', async () => {
      git.isRebaseInProgress.mockResolvedValue(true);

      await expect(detectInProgress()).resolves.toBe('rebase');
    });

    it('should prefer rebase over merge when both look active', async () => {
      // A rebase stopped on a conflict also leaves merge state behind, and
      // calling that a merge would offer the wrong exits.
      git.isRebaseInProgress.mockResolvedValue(true);
      git.isMergeInProgress.mockResolvedValue(true);

      await expect(detectInProgress()).resolves.toBe('rebase');
    });

    it('should report a cherry-pick', async () => {
      git.isCherryPickInProgress.mockResolvedValue(true);

      await expect(detectInProgress()).resolves.toBe('cherryPick');
    });

    it('should report a bisect', async () => {
      git.isBisectInProgress.mockResolvedValue(true);

      await expect(detectInProgress()).resolves.toBe('bisect');
    });
  });

  describe('choices offered', () => {
    it('should offer continue and skip for a clean rebase', async () => {
      select.mockResolvedValue('ignore' as never);

      await runInProgressFlow('rebase');

      expect(offeredValues()).toEqual(expect.arrayContaining(['continue', 'skip', 'abort']));
    });

    it('should replace continue with conflict resolution while markers remain', async () => {
      git.getConflictedFiles.mockResolvedValue(['a.txt']);
      select.mockResolvedValue('ignore' as never);

      await runInProgressFlow('rebase');

      const offered = offeredValues();
      expect(offered).toContain('resolve');
      expect(offered).not.toContain('continue');
    });

    it('should not offer skip for a cherry-pick', async () => {
      select.mockResolvedValue('ignore' as never);

      await runInProgressFlow('cherryPick');

      expect(offeredValues()).not.toContain('skip');
    });

    it('should offer only abort for a bisect', async () => {
      select.mockResolvedValue('ignore' as never);

      await runInProgressFlow('bisect');

      expect(offeredValues()).toEqual(['abort', 'ignore']);
    });
  });

  describe('continuing', () => {
    it('should report success only when the rebase actually finished', async () => {
      git.continueRebase.mockResolvedValue(true);
      select.mockResolvedValue('continue' as never);

      await expect(runInProgressFlow('rebase')).resolves.toBe(true);
    });

    it('should not claim success when the rebase did not finish', async () => {
      // The critical case: no exception is thrown, yet nothing was achieved.
      git.continueRebase.mockResolvedValue(false);
      select.mockResolvedValue('continue' as never);

      await expect(runInProgressFlow('rebase')).resolves.toBe(false);
    });

    it('should continue a cherry-pick', async () => {
      git.continueCherryPick.mockResolvedValue(true);
      select.mockResolvedValue('continue' as never);

      await runInProgressFlow('cherryPick');

      expect(git.continueCherryPick).toHaveBeenCalled();
    });

    it('should finish a merge by committing it', async () => {
      git.commitNoEdit.mockResolvedValue('abc1234');
      git.isMergeInProgress.mockResolvedValue(false);
      select.mockResolvedValue('continue' as never);

      await expect(runInProgressFlow('merge')).resolves.toBe(true);
      expect(git.commitNoEdit).toHaveBeenCalled();
    });

    it('should report failure when a merge commit leaves the merge running', async () => {
      git.commitNoEdit.mockResolvedValue('');
      git.isMergeInProgress.mockResolvedValue(true);
      select.mockResolvedValue('continue' as never);

      await expect(runInProgressFlow('merge')).resolves.toBe(false);
    });

    it('should surface a genuine error without claiming success', async () => {
      git.continueRebase.mockRejectedValue(new Error('disk full'));
      select.mockResolvedValue('continue' as never);

      await expect(runInProgressFlow('rebase')).resolves.toBe(false);
    });
  });

  describe('skipping and aborting', () => {
    it('should skip the offending commit', async () => {
      select.mockResolvedValue('skip' as never);

      await expect(runInProgressFlow('rebase')).resolves.toBe(true);
      expect(git.skipRebase).toHaveBeenCalled();
    });

    it('should abort a rebase', async () => {
      select.mockResolvedValue('abort' as never);

      await expect(runInProgressFlow('rebase')).resolves.toBe(true);
      expect(git.abortRebase).toHaveBeenCalled();
    });

    it('should abort a cherry-pick', async () => {
      select.mockResolvedValue('abort' as never);

      await runInProgressFlow('cherryPick');

      expect(git.abortCherryPick).toHaveBeenCalled();
    });

    it('should abort a merge', async () => {
      select.mockResolvedValue('abort' as never);

      await runInProgressFlow('merge');

      expect(git.abortMerge).toHaveBeenCalled();
    });

    it('should end a bisect session with reset', async () => {
      select.mockResolvedValue('abort' as never);

      await expect(runInProgressFlow('bisect')).resolves.toBe(true);
      expect(git.abortBisect).toHaveBeenCalled();
    });

    it('should change nothing when the user chooses to leave it alone', async () => {
      select.mockResolvedValue('ignore' as never);

      await expect(runInProgressFlow('rebase')).resolves.toBe(false);
      expect(git.continueRebase).not.toHaveBeenCalled();
      expect(git.abortRebase).not.toHaveBeenCalled();
      expect(git.skipRebase).not.toHaveBeenCalled();
    });
  });

  describe('educational output', () => {
    it('should echo the git command for every exit it takes', async () => {
      select.mockResolvedValue('abort' as never);

      await runInProgressFlow('rebase');

      expect(logger.command).toHaveBeenCalledWith('git rebase --abort');
    });
  });
});
