/**
 * Integration tests for interrupted git operations.
 *
 * These deliberately provoke real conflicts, because the states under test
 * (rebase stopped mid-way, cherry-pick halted, bisect running) only exist when
 * git itself creates them. A mock would assert nothing about whether the exits
 * actually work.
 */

// git-service imports logger, which imports chalk; chalk ships ESM that Jest
// will not transform, so the logger is replaced with a factory mock.
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

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { createTestRepoWithCommit } from '../helpers/test-utils.js';
import { GitService } from '../../src/services/git-service.js';

describe('Interrupted operations', () => {
  let repo: ReturnType<typeof createTestRepoWithCommit>;
  let git: GitService;

  const run = (command: string) =>
    execSync(command, { cwd: repo.path, stdio: 'pipe' });

  const write = (name: string, content: string) =>
    writeFileSync(join(repo.path, name), content, 'utf-8');

  /**
   * Two branches that edit the same line, which is the cheapest way to make
   * git stop part-way through a rebase or a cherry-pick.
   */
  const createDivergingBranches = () => {
    write('shared.txt', 'original\n');
    run('git add -A');
    run('git commit -m "Add shared file"');

    run('git checkout -b feature');
    write('shared.txt', 'feature version\n');
    run('git add -A');
    run('git commit -m "Feature edit"');

    run('git checkout master');
    write('shared.txt', 'master version\n');
    run('git add -A');
    run('git commit -m "Master edit"');
  };

  beforeEach(() => {
    repo = createTestRepoWithCommit('in-progress');
    git = new GitService(repo.path);
    run('git branch -M master');
  });

  afterEach(() => repo.cleanup());

  describe('detection', () => {
    it('should report nothing in progress in a clean repository', async () => {
      await expect(git.isRebaseInProgress()).resolves.toBe(false);
      await expect(git.isCherryPickInProgress()).resolves.toBe(false);
      await expect(git.isMergeInProgress()).resolves.toBe(false);
      await expect(git.isBisectInProgress()).resolves.toBe(false);
    });
  });

  describe('rebase', () => {
    beforeEach(() => {
      createDivergingBranches();
      run('git checkout feature');
      try {
        run('git rebase master');
      } catch {
        // Expected: the rebase stops on the conflict we just engineered.
      }
    });

    it('should detect the interrupted rebase', async () => {
      await expect(git.isRebaseInProgress()).resolves.toBe(true);
      await expect(git.hasConflicts()).resolves.toBe(true);
    });

    it('should report how far the rebase got', async () => {
      const progress = await git.getRebaseProgress();

      expect(progress).not.toBeNull();
      expect(progress!.current).toBeGreaterThanOrEqual(1);
      expect(progress!.total).toBeGreaterThanOrEqual(progress!.current);
    });

    it('should continue once the conflict is resolved', async () => {
      write('shared.txt', 'resolved\n');
      run('git add shared.txt');

      await expect(git.continueRebase()).resolves.toBe(true);

      await expect(git.isRebaseInProgress()).resolves.toBe(false);
      await expect(git.hasConflicts()).resolves.toBe(false);
    });

    it('should report failure, not success, while conflicts remain', async () => {
      // simple-git resolves even though git exits non-zero here, so the return
      // value is what stops the UI announcing a success that did not happen.
      await expect(git.continueRebase()).resolves.toBe(false);

      await expect(git.isRebaseInProgress()).resolves.toBe(true);
      await expect(git.hasConflicts()).resolves.toBe(true);
    });

    it('should skip the offending commit', async () => {
      await git.skipRebase();

      await expect(git.isRebaseInProgress()).resolves.toBe(false);
      await expect(git.hasConflicts()).resolves.toBe(false);
    });

    it('should abort back to the starting point', async () => {
      await git.abortRebase();

      await expect(git.isRebaseInProgress()).resolves.toBe(false);
      await expect(git.getCurrentBranch()).resolves.toBe('feature');
      const [head] = await git.getLog(1);
      expect(head.message).toBe('Feature edit');
    });
  });

  describe('cherry-pick', () => {
    beforeEach(() => {
      createDivergingBranches();
      try {
        // Replaying the feature edit onto master touches the same line.
        run('git cherry-pick feature');
      } catch {
        // Expected: the cherry-pick stops on the conflict.
      }
    });

    it('should detect the interrupted cherry-pick', async () => {
      await expect(git.isCherryPickInProgress()).resolves.toBe(true);
    });

    it('should abort back to the starting point', async () => {
      await git.abortCherryPick();

      await expect(git.isCherryPickInProgress()).resolves.toBe(false);
      await expect(git.hasConflicts()).resolves.toBe(false);
      const [head] = await git.getLog(1);
      expect(head.message).toBe('Master edit');
    });

    it('should continue once the conflict is resolved', async () => {
      write('shared.txt', 'resolved\n');
      run('git add shared.txt');

      await expect(git.continueCherryPick()).resolves.toBe(true);

      await expect(git.isCherryPickInProgress()).resolves.toBe(false);
      const [head] = await git.getLog(1);
      expect(head.message).toBe('Feature edit');
    });

    it('should report failure, not success, while conflicts remain', async () => {
      await expect(git.continueCherryPick()).resolves.toBe(false);

      await expect(git.isCherryPickInProgress()).resolves.toBe(true);
    });
  });

  describe('merge', () => {
    beforeEach(() => {
      createDivergingBranches();
      try {
        run('git merge feature');
      } catch {
        // Expected: the merge stops on the conflict.
      }
    });

    it('should detect the interrupted merge', async () => {
      await expect(git.isMergeInProgress()).resolves.toBe(true);
    });

    it('should abort back to the starting point', async () => {
      await git.abortMerge();

      await expect(git.isMergeInProgress()).resolves.toBe(false);
      const [head] = await git.getLog(1);
      expect(head.message).toBe('Master edit');
    });

    it('should complete the merge once resolved', async () => {
      write('shared.txt', 'resolved\n');
      run('git add shared.txt');

      await git.commitNoEdit();

      await expect(git.isMergeInProgress()).resolves.toBe(false);
      const status = await git.getStatus();
      expect(status.isClean).toBe(true);
    });
  });

  describe('bisect', () => {
    beforeEach(() => {
      write('a.txt', 'a');
      run('git add -A');
      run('git commit -m "Second"');
      run('git bisect start');
      run('git bisect bad');
      try {
        run('git bisect good HEAD~1');
      } catch {
        // Bisect may finish immediately on a two-commit range.
      }
    });

    it('should detect the bisect session', async () => {
      await expect(git.isBisectInProgress()).resolves.toBe(true);
    });

    it('should end the session and restore the branch', async () => {
      await git.abortBisect();

      await expect(git.isBisectInProgress()).resolves.toBe(false);
      await expect(git.getCurrentBranch()).resolves.toBe('master');
    });
  });
});
