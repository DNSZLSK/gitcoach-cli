/**
 * Integration tests for the everyday git-service methods.
 *
 * These are the most-travelled paths in the whole tool, and until now they were
 * only ever exercised through a mock that replaced them, so nothing verified
 * that staging, committing, stashing or resetting behaved as the menus assume.
 * Everything here runs against real repositories.
 */

// git-service imports logger, which imports chalk; chalk ships ESM that Jest
// will not transform, so the logger is replaced with a factory mock.
vi.mock('../../src/utils/logger.js', async () => (await import('../helpers/module-mocks.js')).loggerMock());

import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createTestRepoWithCommit, createTestRepoWithRemote, createNonGitDir } from '../helpers/test-utils.js';
import { GitService } from '../../src/services/git-service.js';

describe('git-service core', () => {
  let repo: ReturnType<typeof createTestRepoWithCommit>;
  let git: GitService;

  const run = (command: string) => execSync(command, { cwd: repo.path, stdio: 'pipe' });
  const write = (name: string, content: string) =>
    writeFileSync(join(repo.path, name), content, 'utf-8');

  beforeEach(() => {
    repo = createTestRepoWithCommit('core');
    git = new GitService(repo.path);
    run('git branch -M master');
  });

  afterEach(() => repo.cleanup());

  describe('repository detection', () => {
    it('should recognise a repository', async () => {
      await expect(git.isGitRepo()).resolves.toBe(true);
    });

    it('should reject a plain folder', async () => {
      const plain = createNonGitDir('core-plain');
      try {
        await expect(new GitService(plain.path).isGitRepo()).resolves.toBe(false);
      } finally {
        plain.cleanup();
      }
    });
  });

  describe('status', () => {
    it('should report a clean tree after the initial commit', async () => {
      const status = await git.getStatus();

      expect(status.isClean).toBe(true);
      expect(status.current).toBe('master');
    });

    it('should list an untracked file', async () => {
      write('new.txt', 'hello');

      const status = await git.getStatus();

      expect(status.isClean).toBe(false);
      expect(status.untracked).toContain('new.txt');
    });

    it('should separate staged from modified files', async () => {
      write('staged.txt', 'staged');
      await git.add(['staged.txt']);
      write('README.md', 'changed');

      // The status cache would otherwise serve a stale answer here.
      const staged = await git.getStagedFiles();
      const unstaged = await git.getUnstagedFiles();

      expect(staged).toContain('staged.txt');
      expect(unstaged).toContain('README.md');
    });

    it('should report uncommitted changes', async () => {
      await expect(git.hasUncommittedChanges()).resolves.toBe(false);

      write('dirty.txt', 'dirty');

      await expect(git.hasUncommittedChanges()).resolves.toBe(true);
    });
  });

  describe('staging and committing', () => {
    it('should stage a single file', async () => {
      write('one.txt', '1');

      await git.add(['one.txt']);

      await expect(git.getStagedFiles()).resolves.toContain('one.txt');
    });

    it('should stage everything', async () => {
      write('a.txt', 'a');
      write('b.txt', 'b');

      await git.addAll();

      const staged = await git.getStagedFiles();
      expect(staged).toEqual(expect.arrayContaining(['a.txt', 'b.txt']));
    });

    it('should commit staged files and return a hash', async () => {
      write('c.txt', 'c');
      await git.addAll();

      const hash = await git.commit('Add c');

      expect(hash).toBeTruthy();
      await expect(git.getLastCommitMessage()).resolves.toBe('Add c');
    });

    it('should leave the tree clean after committing', async () => {
      write('d.txt', 'd');
      await git.addAll();
      await git.commit('Add d');

      const status = await git.getStatus();
      expect(status.isClean).toBe(true);
    });
  });

  describe('diffs', () => {
    it('should show nothing for a clean tree', async () => {
      await expect(git.getDiff(false)).resolves.toBe('');
    });

    it('should show a staged diff only when asked for staged', async () => {
      write('README.md', 'modified content');
      await git.add(['README.md']);

      const staged = await git.getDiff(true);
      expect(staged).toContain('README.md');
    });

    it('should summarise changes', async () => {
      write('README.md', 'modified content');

      const summary = await git.getDiffSummary();
      expect(summary).toBeDefined();
    });
  });

  describe('branches', () => {
    it('should report the current branch', async () => {
      await expect(git.getCurrentBranch()).resolves.toBe('master');
    });

    it('should create and switch to a branch', async () => {
      await git.createBranch('feature', true);

      await expect(git.getCurrentBranch()).resolves.toBe('feature');
    });

    it('should create a branch without switching', async () => {
      await git.createBranch('later', false);

      await expect(git.getCurrentBranch()).resolves.toBe('master');
      const names = (await git.getLocalBranches()).map(branch => branch.name);
      expect(names).toContain('later');
    });

    it('should check out an existing branch', async () => {
      await git.createBranch('other', false);

      await git.checkout('other');

      await expect(git.getCurrentBranch()).resolves.toBe('other');
    });

    it('should delete a merged branch', async () => {
      await git.createBranch('doomed', false);

      await git.deleteBranch('doomed');

      const names = (await git.getLocalBranches()).map(branch => branch.name);
      expect(names).not.toContain('doomed');
    });

    it('should merge a branch', async () => {
      await git.createBranch('side', true);
      write('side.txt', 'side');
      await git.addAll();
      await git.commit('Side work');
      await git.checkout('master');

      await git.merge('side');

      const messages = (await git.getLog(10)).map(entry => entry.message);
      expect(messages).toContain('Side work');
    });

    it('should create a branch at a given commit', async () => {
      write('second.txt', '2');
      await git.addAll();
      await git.commit('Second');
      const [, first] = await git.getLog(10);

      await git.createBranchAt('from-first', first.hash);

      const names = (await git.getLocalBranches()).map(branch => branch.name);
      expect(names).toContain('from-first');
    });

    it('should detect a detached HEAD', async () => {
      await expect(git.isDetachedHead()).resolves.toBe(false);

      const [head] = await git.getLog(1);
      run(`git checkout -q ${head.hash}`);

      await expect(git.isDetachedHead()).resolves.toBe(true);
    });
  });

  describe('history', () => {
    it('should return the log newest first', async () => {
      write('x.txt', 'x');
      await git.addAll();
      await git.commit('Newer');

      const log = await git.getLog(10);

      expect(log[0].message).toBe('Newer');
      expect(log[1].message).toBe('Initial commit');
    });

    it('should respect the requested count', async () => {
      write('y.txt', 'y');
      await git.addAll();
      await git.commit('Another');

      await expect(git.getLog(1)).resolves.toHaveLength(1);
    });

    it('should tolerate a repository with no commits', async () => {
      const empty = mkdtempSync(join(tmpdir(), 'gitcoach-empty-'));
      try {
        execSync('git init -q .', { cwd: empty });
        await expect(new GitService(empty).getLog(5)).resolves.toEqual([]);
      } finally {
        rmSync(empty, { recursive: true, force: true });
      }
    });

    it('should return reflog entries', async () => {
      write('z.txt', 'z');
      await git.addAll();
      await git.commit('Reflog subject');

      const reflog = await git.getReflog(10);
      expect(reflog.length).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should unstage with a mixed reset', async () => {
      write('staged.txt', 'staged');
      await git.addAll();

      await git.reset('mixed');

      await expect(git.getStagedFiles()).resolves.toEqual([]);
    });

    it('should keep changes with a soft reset', async () => {
      write('soft.txt', 'soft');
      await git.addAll();
      await git.commit('To undo');

      await git.reset('soft', 'HEAD~1');

      const staged = await git.getStagedFiles();
      expect(staged).toContain('soft.txt');
    });

    it('should discard changes with a hard reset', async () => {
      write('hard.txt', 'hard');
      await git.addAll();
      await git.commit('To discard');

      await git.reset('hard', 'HEAD~1');

      const status = await git.getStatus();
      expect(status.isClean).toBe(true);
      await expect(git.getLastCommitMessage()).resolves.toBe('Initial commit');
    });
  });

  describe('stash', () => {
    it('should stash and restore changes', async () => {
      write('README.md', 'work in progress');

      await git.stash('wip');

      expect((await git.getStatus()).isClean).toBe(true);

      await git.stashPop();

      expect((await git.getStatus()).isClean).toBe(false);
    });

    it('should list stashes', async () => {
      write('README.md', 'first');
      await git.stash('one');

      const stashes = await git.getStashList();
      expect(stashes.length).toBeGreaterThan(0);
    });

    it('should drop a stash without applying it', async () => {
      write('README.md', 'to drop');
      await git.stash('dropme');
      const before = (await git.getStashList()).length;

      await git.stashDrop(0);

      expect((await git.getStashList()).length).toBe(before - 1);
    });
  });

  describe('identity', () => {
    it('should read the configured identity', async () => {
      const identity = await git.getUserIdentity();

      expect(identity.name).toBeTruthy();
      expect(identity.email).toBeTruthy();
    });

    it('should write a new identity', async () => {
      await git.setUserIdentity('Someone Else', 'else@example.com');

      const identity = await git.getUserIdentity();
      expect(identity.name).toBe('Someone Else');
      expect(identity.email).toBe('else@example.com');
    });
  });

  describe('file contents and large files', () => {
    it('should read a file at HEAD', async () => {
      const content = await git.getFileContent('README.md');

      expect(content).toContain('Test Repository');
    });

    it('should report no large staged files for a small change', async () => {
      write('small.txt', 'tiny');
      await git.addAll();

      // 50 MB is the threshold the staging warning uses.
      await expect(git.getLargeStagedFiles(50 * 1024 * 1024)).resolves.toEqual([]);
    });

    it('should flag a staged file above the threshold', async () => {
      write('big.txt', 'x'.repeat(2048));
      await git.addAll();

      const large = await git.getLargeStagedFiles(1024);

      expect(large).toContain('big.txt');
    });
  });

  describe('remotes', () => {
    it('should report no remote on a local-only repository', async () => {
      await expect(git.hasRemote()).resolves.toBe(false);
      await expect(git.getRemotes()).resolves.toEqual([]);
    });

    it('should add and read back a remote', async () => {
      await git.addRemote('origin', 'https://github.com/example/repo.git');

      await expect(git.hasRemote()).resolves.toBe(true);
      await expect(git.getRemoteUrl('origin')).resolves.toBe(
        'https://github.com/example/repo.git'
      );
    });

    it('should remove a remote', async () => {
      await git.addRemote('origin', 'https://github.com/example/repo.git');

      await git.removeRemote('origin');

      await expect(git.hasRemote()).resolves.toBe(false);
    });
  });

  describe('against a real remote', () => {
    let fixture: ReturnType<typeof createTestRepoWithRemote>;
    let linked: GitService;

    beforeEach(() => {
      fixture = createTestRepoWithRemote('core-remote');
      linked = new GitService(fixture.repo.path);
    });

    afterEach(() => {
      fixture.repo.cleanup();
      fixture.remote.cleanup();
    });

    it('should push and then report nothing unpushed', async () => {
      await linked.push('origin', undefined, false, true);

      await expect(linked.hasUnpushedCommits()).resolves.toBe(false);
      await expect(linked.getUnpushedCommitCount()).resolves.toBe(0);
    });

    it('should count commits made after a push', async () => {
      await linked.push('origin', undefined, false, true);
      writeFileSync(join(fixture.repo.path, 'after.txt'), 'after', 'utf-8');
      await linked.addAll();
      await linked.commit('After push');

      await expect(linked.getUnpushedCommitCount()).resolves.toBe(1);
    });

    it('should report the upstream the fixture already configured', async () => {
      // createTestRepoWithRemote pushes with -u, so tracking is set from the
      // start; this pins that hasUpstream sees it.
      await expect(linked.hasUpstream()).resolves.toBe(true);
    });

    it('should report no upstream for a branch that was never pushed', async () => {
      await linked.createBranch('untracked-branch', true);

      await expect(linked.hasUpstream()).resolves.toBe(false);
    });

    it('should fetch without changing the working tree', async () => {
      await linked.push('origin', undefined, false, true);

      await linked.fetch();

      expect((await linked.getStatus()).isClean).toBe(true);
    });
  });
});
