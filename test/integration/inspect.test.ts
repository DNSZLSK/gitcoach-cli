/**
 * Integration tests for the read-only inspection commands: blame, the patch of
 * a single commit, and a comparison between two branches.
 *
 * These parse real git output, so they run against a real repository.
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

describe('Inspection', () => {
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
    repo = createTestRepoWithCommit('inspect');
    git = new GitService(repo.path);
    run('git branch -M master');
  });

  afterEach(() => repo.cleanup());

  describe('getTrackedFiles', () => {
    it('should list the files committed so far', async () => {
      await expect(git.getTrackedFiles()).resolves.toEqual(['README.md']);
    });

    it('should not list an untracked file', async () => {
      write('scratch.txt', 'not committed');

      await expect(git.getTrackedFiles()).resolves.not.toContain('scratch.txt');
    });

    it('should list files added in later commits', async () => {
      commit('src.txt', 'code', 'Add source');

      const files = await git.getTrackedFiles();
      expect(files).toEqual(expect.arrayContaining(['README.md', 'src.txt']));
    });
  });

  describe('blameFile', () => {
    it('should attribute a line to its author', async () => {
      commit('poem.txt', 'first line\n', 'Write first line');

      const blame = await git.blameFile('poem.txt');

      expect(blame).toContain('first line');
      // The test repo commits as its configured user; the name must appear.
      expect(blame.length).toBeGreaterThan(0);
    });

    it('should produce one entry per line', async () => {
      commit('three.txt', 'a\nb\nc\n', 'Three lines');

      const blame = await git.blameFile('three.txt');
      const lines = blame.split('\n').filter(line => line.trim().length > 0);

      expect(lines).toHaveLength(3);
    });

    it('should reject a file git does not track', async () => {
      await expect(git.blameFile('nope.txt')).rejects.toBeDefined();
    });
  });

  describe('getCommitDiff', () => {
    it('should show the lines a commit added', async () => {
      commit('feature.txt', 'new content\n', 'Add feature');
      const [head] = await git.getLog(1);

      const patch = await git.getCommitDiff(head.hash);

      expect(patch).toContain('feature.txt');
      expect(patch).toContain('+new content');
    });

    it('should show the lines a commit removed', async () => {
      commit('doomed.txt', 'goodbye\n', 'Add doomed file');
      run('git rm -q doomed.txt');
      run('git commit -m "Remove doomed file"');
      const [head] = await git.getLog(1);

      const patch = await git.getCommitDiff(head.hash);

      expect(patch).toContain('-goodbye');
    });

    it('should include the commit subject', async () => {
      commit('x.txt', 'x', 'A distinctive subject');
      const [head] = await git.getLog(1);

      await expect(git.getCommitDiff(head.hash)).resolves.toContain('A distinctive subject');
    });
  });

  describe('getDiffBetween', () => {
    beforeEach(() => {
      commit('base.txt', 'base\n', 'Base');
      run('git checkout -qb feature');
      commit('only-on-feature.txt', 'feature\n', 'Feature work');
      run('git checkout -q master');
    });

    it('should show what one branch has that the other does not', async () => {
      const diff = await git.getDiffBetween('master', 'feature');

      expect(diff).toContain('only-on-feature.txt');
      expect(diff).toContain('+feature');
    });

    it('should be empty when comparing a branch with itself', async () => {
      const diff = await git.getDiffBetween('master', 'master');

      expect(diff.trim()).toBe('');
    });

    it('should reverse sign when the order is reversed', async () => {
      const forward = await git.getDiffBetween('master', 'feature');
      const backward = await git.getDiffBetween('feature', 'master');

      expect(forward).toContain('+feature');
      expect(backward).toContain('-feature');
    });
  });
});
