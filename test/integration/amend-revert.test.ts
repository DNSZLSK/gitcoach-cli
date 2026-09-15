/**
 * Integration tests for amending and reverting, against a real repository.
 *
 * Both operations change history, so the assertions check what happened to the
 * commit graph, not just that the command returned without throwing.
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

import { createTestRepoWithCommit } from '../helpers/test-utils.js';
import { GitService } from '../../src/services/git-service.js';

describe('Amend and revert', () => {
  let repo: ReturnType<typeof createTestRepoWithCommit>;
  let git: GitService;

  beforeEach(() => {
    repo = createTestRepoWithCommit('amend-revert');
    git = new GitService(repo.path);
  });

  afterEach(() => repo.cleanup());

  describe('getLastCommitMessage', () => {
    it('should return the message of the most recent commit', async () => {
      await expect(git.getLastCommitMessage()).resolves.toBe('Initial commit');
    });

    it('should follow the newest commit', async () => {
      repo.createFile('a.txt', 'a');
      repo.commitAll('Second commit');

      await expect(git.getLastCommitMessage()).resolves.toBe('Second commit');
    });
  });

  describe('amendCommit', () => {
    it('should replace the message of the last commit', async () => {
      await git.amendCommit('Reworded commit');

      await expect(git.getLastCommitMessage()).resolves.toBe('Reworded commit');
    });

    it('should produce a different commit hash', async () => {
      const [before] = await git.getLog(1);
      await git.amendCommit('Reworded commit');
      const [after] = await git.getLog(1);

      // Amending rewrites rather than edits, which is exactly why the menu
      // warns before doing it to a pushed commit.
      expect(after.hash).not.toBe(before.hash);
    });

    it('should not add a commit to history', async () => {
      const before = await git.getLog(50);
      await git.amendCommit('Reworded commit');
      const after = await git.getLog(50);

      expect(after).toHaveLength(before.length);
    });

    it('should fold staged changes into the last commit', async () => {
      repo.createFile('extra.txt', 'content');
      await git.add(['extra.txt']);

      await git.amendCommit('Initial commit with extra');

      const history = await git.getLog(50);
      expect(history).toHaveLength(1);
      const status = await git.getStatus();
      expect(status.isClean).toBe(true);
    });

    it('should keep the existing message when none is given', async () => {
      repo.createFile('extra.txt', 'content');
      await git.add(['extra.txt']);

      await git.amendCommit();

      await expect(git.getLastCommitMessage()).resolves.toBe('Initial commit');
    });
  });

  describe('revertCommit', () => {
    it('should add a commit rather than remove one', async () => {
      repo.createFile('feature.txt', 'feature');
      repo.commitAll('Add feature');
      const before = await git.getLog(50);

      const [head] = await git.getLog(1);
      await git.revertCommit(head.hash);

      const after = await git.getLog(50);
      expect(after).toHaveLength(before.length + 1);
    });

    it('should undo the change on disk', async () => {
      repo.createFile('feature.txt', 'feature');
      repo.commitAll('Add feature');

      const [head] = await git.getLog(1);
      await git.revertCommit(head.hash);

      // The file the reverted commit introduced should be gone again.
      const status = await git.getStatus();
      expect(status.isClean).toBe(true);
      const history = await git.getLog(1);
      expect(history[0].message).toContain('Revert');
    });

    it('should name the reverted commit in the generated message', async () => {
      repo.createFile('feature.txt', 'feature');
      repo.commitAll('Add feature');

      const [head] = await git.getLog(1);
      await git.revertCommit(head.hash);

      // The menu shows this message before confirming, so its shape matters.
      const message = await git.getLastCommitMessage();
      expect(message).toContain('Revert "Add feature"');
      expect(message).toContain('This reverts commit');
    });

    it('should leave earlier commits untouched', async () => {
      repo.createFile('feature.txt', 'feature');
      repo.commitAll('Add feature');
      const [head] = await git.getLog(1);

      await git.revertCommit(head.hash);

      const history = await git.getLog(50);
      const messages = history.map(commit => commit.message);
      expect(messages).toContain('Add feature');
      expect(messages).toContain('Initial commit');
    });
  });
});
