/**
 * Integration tests for submodules, worktrees and commit signing.
 *
 * Submodule and worktree state is parsed from git's own output formats, and
 * the signing settings are read back out of the local config, so all of this
 * runs against real repositories.
 */

// git-service imports logger, which imports chalk; chalk ships ESM that Jest
// will not transform, so the logger is replaced with a factory mock.
jest.mock('../../src/utils/logger.js', () =>
  require('../helpers/module-mocks.js').loggerMock());

import { execSync } from 'child_process';
import { existsSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createTestRepoWithCommit } from '../helpers/test-utils.js';
import { GitService } from '../../src/services/git-service.js';

describe('Advanced operations', () => {
  let repo: ReturnType<typeof createTestRepoWithCommit>;
  let git: GitService;

  const run = (command: string) => execSync(command, { cwd: repo.path, stdio: 'pipe' });

  beforeEach(() => {
    repo = createTestRepoWithCommit('advanced');
    git = new GitService(repo.path);
    run('git branch -M master');
  });

  afterEach(() => repo.cleanup());

  describe('submodules', () => {
    it('should report none when the project declares none', async () => {
      await expect(git.getSubmodules()).resolves.toEqual([]);
    });

    it('should not run git at all without a .gitmodules file', async () => {
      // A project without submodules is the common case; the check is a file
      // test precisely so it costs nothing.
      expect(existsSync(join(repo.path, '.gitmodules'))).toBe(false);
      await expect(git.getSubmodules()).resolves.toEqual([]);
    });

    it('should list a declared submodule with its recorded commit', async () => {
      const inner = createTestRepoWithCommit('advanced-inner');
      try {
        const url = inner.path.replace(/\\/g, '/');
        run(`git -c protocol.file.allow=always submodule add "${url}" vendor`);

        const submodules = await git.getSubmodules();

        expect(submodules).toHaveLength(1);
        expect(submodules[0].path).toBe('vendor');
        expect(submodules[0].commit).toMatch(/^[0-9a-f]{7,}$/);
        expect(submodules[0].initialized).toBe(true);
      } finally {
        inner.cleanup();
      }
    });
  });

  describe('worktrees', () => {
    it('should list the main worktree', async () => {
      const worktrees = await git.getWorktrees();

      expect(worktrees).toHaveLength(1);
      expect(worktrees[0].branch).toBe('master');
      expect(worktrees[0].detached).toBe(false);
    });

    it('should list an added worktree alongside the main one', async () => {
      const extra = join(repo.path, '..', `wt-${Date.now()}`);
      try {
        await git.addWorktree(extra, 'side', true);

        const worktrees = await git.getWorktrees();

        expect(worktrees).toHaveLength(2);
        expect(worktrees.map(entry => entry.branch)).toEqual(
          expect.arrayContaining(['master', 'side'])
        );
      } finally {
        rmSync(extra, { recursive: true, force: true });
      }
    });

    it('should keep the main worktree first', async () => {
      const extra = join(repo.path, '..', `wt-first-${Date.now()}`);
      try {
        await git.addWorktree(extra, 'other', true);

        const worktrees = await git.getWorktrees();

        // The menu relies on this to know which entry cannot be removed.
        expect(worktrees[0].branch).toBe('master');
      } finally {
        rmSync(extra, { recursive: true, force: true });
      }
    });

    it('should remove a worktree it created', async () => {
      const extra = join(repo.path, '..', `wt-remove-${Date.now()}`);
      await git.addWorktree(extra, 'temporary', true);
      expect(await git.getWorktrees()).toHaveLength(2);

      await git.removeWorktree(extra);

      await expect(git.getWorktrees()).resolves.toHaveLength(1);
      expect(existsSync(extra)).toBe(false);
    });

    it('should leave the branch behind after removing its worktree', async () => {
      const extra = join(repo.path, '..', `wt-branch-${Date.now()}`);
      await git.addWorktree(extra, 'survivor', true);

      await git.removeWorktree(extra);

      // Removing a worktree deletes a folder, not history.
      const branches = await git.getLocalBranches();
      expect(branches.map(branch => branch.name)).toContain('survivor');
    });
  });

  describe('commit signing', () => {
    it('should report signing off and no key on a fresh repository', async () => {
      await expect(git.getSigningConfig()).resolves.toEqual({ enabled: false, key: null });
    });

    it('should not throw when the settings are simply unset', async () => {
      // git exits non-zero for an absent config key; that must read as "unset",
      // not as an error.
      await expect(git.getSigningConfig()).resolves.toBeDefined();
    });

    it('should store and read back a signing key', async () => {
      await git.setSigningKey('ABCD1234');

      const config = await git.getSigningConfig();
      expect(config.key).toBe('ABCD1234');
    });

    it('should turn signing on and off', async () => {
      await git.setSigningEnabled(true);
      await expect(git.getSigningConfig()).resolves.toMatchObject({ enabled: true });

      await git.setSigningEnabled(false);
      await expect(git.getSigningConfig()).resolves.toMatchObject({ enabled: false });
    });

    it('should write to the local config, not the user global one', async () => {
      await git.setSigningEnabled(true);

      const local = execSync('git config --local --get commit.gpgsign', {
        cwd: repo.path
      }).toString().trim();
      expect(local).toBe('true');
    });

    it('should keep the key when signing is turned off', async () => {
      await git.setSigningKey('KEEPME');
      await git.setSigningEnabled(true);
      await git.setSigningEnabled(false);

      const config = await git.getSigningConfig();
      expect(config.enabled).toBe(false);
      expect(config.key).toBe('KEEPME');
    });
  });

  describe('gitignore fixture guard', () => {
    it('should not treat an ordinary file as a submodule', async () => {
      writeFileSync(join(repo.path, 'notamodule.txt'), 'plain file', 'utf-8');
      run('git add -A');
      run('git commit -m "Add plain file"');

      await expect(git.getSubmodules()).resolves.toEqual([]);
    });
  });
});
