/**
 * Integration tests for tag operations.
 *
 * These run against a real git repository rather than a mock, because the risk
 * in this code is the parsing of `for-each-ref` and `ls-remote` output, which a
 * mock would not exercise.
 */

// git-service pulls in logger, which imports chalk. chalk ships ESM that Jest
// will not transform, so the logger is replaced with a factory mock; that keeps
// the real git-service under test without loading chalk at all.
vi.mock('../../src/utils/logger.js', async () => (await import('../helpers/module-mocks.js')).loggerMock());

import { createTestRepoWithCommit, createTestRepoWithRemote } from '../helpers/test-utils.js';
import { GitService } from '../../src/services/git-service.js';

describe('Tags', () => {
  describe('create and list', () => {
    let repo: ReturnType<typeof createTestRepoWithCommit>;
    let git: GitService;

    beforeEach(() => {
      repo = createTestRepoWithCommit('tags-basic');
      git = new GitService(repo.path);
    });

    afterEach(() => repo.cleanup());

    it('should report no tags on a fresh repository', async () => {
      await expect(git.getTags()).resolves.toEqual([]);
    });

    it('should create a lightweight tag', async () => {
      await git.createTag('v0.1.0');

      const tags = await git.getTags();
      expect(tags).toHaveLength(1);
      expect(tags[0].name).toBe('v0.1.0');
      expect(tags[0].annotated).toBe(false);
      expect(tags[0].commit).toHaveLength(7);
    });

    it('should create an annotated tag carrying its message', async () => {
      await git.createTag('v1.0.0', 'First release');

      const [tag] = await git.getTags();
      expect(tag.name).toBe('v1.0.0');
      expect(tag.annotated).toBe(true);
      expect(tag.message).toBe('First release');
    });

    it('should not confuse an annotated tag with a lightweight one', async () => {
      await git.createTag('light');
      await git.createTag('heavy', 'annotated please');

      const tags = await git.getTags();
      const byName = Object.fromEntries(tags.map(tag => [tag.name, tag]));
      expect(byName.light.annotated).toBe(false);
      expect(byName.heavy.annotated).toBe(true);
    });

    it('should keep a message containing spaces and punctuation intact', async () => {
      // The implementation joins fields with a separator; a message with
      // unusual characters must not split into the wrong columns.
      const message = 'Release 2.0: faster, safer & tested';
      await git.createTag('v2.0.0', message);

      const [tag] = await git.getTags();
      expect(tag.message).toBe(message);
      expect(tag.name).toBe('v2.0.0');
    });

    it('should report whether a tag exists', async () => {
      await git.createTag('v1.0.0', 'release');

      await expect(git.tagExists('v1.0.0')).resolves.toBe(true);
      await expect(git.tagExists('v9.9.9')).resolves.toBe(false);
    });

    it('should delete a tag', async () => {
      await git.createTag('doomed', 'temporary');
      await expect(git.tagExists('doomed')).resolves.toBe(true);

      await git.deleteTag('doomed');
      await expect(git.tagExists('doomed')).resolves.toBe(false);
    });

    it('should reject a duplicate tag name', async () => {
      await git.createTag('v1.0.0');
      await expect(git.createTag('v1.0.0')).rejects.toBeDefined();
    });
  });

  describe('pushing to a remote', () => {
    let fixture: ReturnType<typeof createTestRepoWithRemote>;
    let git: GitService;

    beforeEach(() => {
      fixture = createTestRepoWithRemote('tags-remote');
      git = new GitService(fixture.repo.path);
    });

    afterEach(() => {
      fixture.repo.cleanup();
      fixture.remote.cleanup();
    });

    it('should list a local-only tag as unpushed', async () => {
      await git.createTag('v1.0.0', 'release');

      await expect(git.getUnpushedTags()).resolves.toEqual(['v1.0.0']);
    });

    it('should stop listing a tag once pushed', async () => {
      await git.createTag('v1.0.0', 'release');
      await git.pushTag('v1.0.0');

      await expect(git.getUnpushedTags()).resolves.toEqual([]);
    });

    it('should push every tag at once', async () => {
      await git.createTag('v1.0.0', 'one');
      await git.createTag('v1.1.0', 'two');

      await git.pushAllTags();

      await expect(git.getUnpushedTags()).resolves.toEqual([]);
    });

    it('should not report an annotated tag as unpushed after pushing it', async () => {
      // ls-remote lists an annotated tag twice, the second entry suffixed with
      // ^{}. Without stripping that suffix the tag looks absent on the remote.
      await git.createTag('v3.0.0', 'annotated release');
      await git.pushAllTags();

      const unpushed = await git.getUnpushedTags();
      expect(unpushed).not.toContain('v3.0.0');
      expect(unpushed).toEqual([]);
    });

    it('should delete a tag on the remote', async () => {
      await git.createTag('v1.0.0', 'release');
      await git.pushTag('v1.0.0');
      await expect(git.getUnpushedTags()).resolves.toEqual([]);

      await git.deleteRemoteTag('v1.0.0');

      // Still local, gone from the remote, so it counts as unpushed again.
      await expect(git.getUnpushedTags()).resolves.toEqual(['v1.0.0']);
    });
  });
});
