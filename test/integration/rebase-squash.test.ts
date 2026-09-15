/**
 * Integration tests for rebasing and squashing, against real repositories.
 *
 * Both rewrite history, so the assertions look at the resulting commit graph:
 * what survived, what disappeared, and where the branch ended up.
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

describe('Rebase and squash', () => {
  let repo: ReturnType<typeof createTestRepoWithCommit>;
  let git: GitService;

  const run = (command: string) => execSync(command, { cwd: repo.path, stdio: 'pipe' });
  const write = (name: string, content: string) =>
    writeFileSync(join(repo.path, name), content, 'utf-8');

  const commit = (file: string, content: string, message: string) => {
    write(file, content);
    run('git add -A');
    run(`git commit -m "${message}"`);
  };

  beforeEach(() => {
    repo = createTestRepoWithCommit('rebase-squash');
    git = new GitService(repo.path);
    run('git branch -M master');
  });

  afterEach(() => repo.cleanup());

  describe('getCommitsAhead', () => {
    it('should report nothing ahead of itself', async () => {
      await expect(git.getCommitsAhead('master')).resolves.toEqual([]);
    });

    it('should count only the commits the other branch lacks', async () => {
      run('git checkout -qb feature');
      commit('a.txt', 'a', 'Feature one');
      commit('b.txt', 'b', 'Feature two');

      const ahead = await git.getCommitsAhead('master');

      expect(ahead).toHaveLength(2);
      expect(ahead.map(entry => entry.message)).toEqual(['Feature two', 'Feature one']);
    });
  });

  describe('rebaseOnto', () => {
    beforeEach(() => {
      commit('base.txt', 'base', 'Base commit');
      run('git checkout -qb feature');
      commit('feature.txt', 'feature', 'Feature work');
      run('git checkout -q master');
      commit('master.txt', 'master', 'Master work');
      run('git checkout -q feature');
    });

    it('should replay the branch and report success', async () => {
      await expect(git.rebaseOnto('master')).resolves.toBe(true);

      await expect(git.isRebaseInProgress()).resolves.toBe(false);
    });

    it('should place the master commit underneath the feature commit', async () => {
      await git.rebaseOnto('master');

      const history = await git.getLog(10);
      const messages = history.map(entry => entry.message);
      // After replaying, the feature commit sits on top of master's work.
      expect(messages[0]).toBe('Feature work');
      expect(messages[1]).toBe('Master work');
    });

    it('should report false rather than throw when it stops on a conflict', async () => {
      // Make both branches touch the same file so the replay cannot apply
      // cleanly. A stopped rebase is a state to handle, not an error.
      run('git checkout -q master');
      commit('shared.txt', 'master version', 'Master edits shared');
      run('git checkout -q feature');
      commit('shared.txt', 'feature version', 'Feature edits shared');

      await expect(git.rebaseOnto('master')).resolves.toBe(false);

      await expect(git.isRebaseInProgress()).resolves.toBe(true);
      await expect(git.hasConflicts()).resolves.toBe(true);
    });
  });

  describe('squashCommits', () => {
    beforeEach(() => {
      commit('one.txt', '1', 'First change');
      commit('two.txt', '2', 'Second change');
      commit('three.txt', '3', 'Third change');
    });

    it('should replace the last commits with a single one', async () => {
      const before = await git.getLog(50);

      await git.squashCommits(3, 'Squashed the three changes');

      const after = await git.getLog(50);
      expect(after).toHaveLength(before.length - 2);
      expect(after[0].message).toBe('Squashed the three changes');
    });

    it('should keep every file the squashed commits introduced', async () => {
      await git.squashCommits(3, 'Squashed');

      const status = await git.getStatus();
      expect(status.isClean).toBe(true);
      // All three files remain tracked; only the history collapsed.
      const tracked = run('git ls-files').toString().split('\n').filter(Boolean);
      expect(tracked).toEqual(expect.arrayContaining(['one.txt', 'two.txt', 'three.txt']));
    });

    it('should leave older commits untouched', async () => {
      await git.squashCommits(2, 'Squashed the last two');

      const messages = (await git.getLog(50)).map(entry => entry.message);
      expect(messages).toContain('First change');
      expect(messages).toContain('Squashed the last two');
      expect(messages).not.toContain('Third change');
    });

    it('should refuse to squash fewer than two commits', async () => {
      await expect(git.squashCommits(1, 'Nope')).rejects.toThrow(
        'Squashing needs at least two commits'
      );
    });

    it('should not lose history when asked to squash exactly two', async () => {
      const before = await git.getLog(50);

      await git.squashCommits(2, 'Two into one');

      const after = await git.getLog(50);
      expect(after).toHaveLength(before.length - 1);
    });
  });
});
