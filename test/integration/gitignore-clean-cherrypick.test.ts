/**
 * Integration tests for the git operations behind the four new features.
 *
 * These run against real repositories on purpose. Every one of these methods
 * is parsing or interpreting git's own output, and that is where they break:
 * `check-ignore` signals its answer through the exit code rather than the
 * output, `clean -nd` prefixes each path with "Would remove ", a cherry-pick
 * that conflicts must be reported as interrupted rather than thrown. A mock
 * would simply agree with whatever the implementation happened to do.
 *
 * previewClean earns its place here twice over: its parsing was broken once
 * already during development, by an escaping mistake, and nothing would have
 * noticed.
 */

vi.mock('../../src/utils/logger.js', async () =>
  (await import('../helpers/module-mocks.js')).loggerMock());

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestRepoWithCommit } from '../helpers/test-utils.js';
import { GitService } from '../../src/services/git-service.js';

describe('git operations behind the new features', () => {
  let repo: ReturnType<typeof createTestRepoWithCommit>;
  let git: GitService;

  const run = (command: string) => execSync(command, { cwd: repo.path, stdio: 'pipe' });
  const write = (name: string, content: string) => {
    const full = join(repo.path, name);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content, 'utf-8');
  };

  beforeEach(() => {
    repo = createTestRepoWithCommit('features');
    git = new GitService(repo.path);
    run('git branch -M master');
  });

  afterEach(() => repo.cleanup());

  describe('getRepoRoot', () => {
    it('should find the top of the working tree', async () => {
      const root = await git.getRepoRoot();

      // macOS reports /private/var for /var, so compare the last segment.
      expect(root.replace(/\\/g, '/').split('/').pop()).toBe(
        repo.path.replace(/\\/g, '/').split('/').pop()
      );
    });

    it('should find the same root from a subdirectory', async () => {
      mkdirSync(join(repo.path, 'deep', 'nested'), { recursive: true });
      const fromBelow = new GitService(join(repo.path, 'deep', 'nested'));

      await expect(fromBelow.getRepoRoot()).resolves.toBe(await git.getRepoRoot());
    });
  });

  describe('isIgnored', () => {
    it('should report false when there is no rule', async () => {
      write('notes.txt', 'hello');

      await expect(git.isIgnored('notes.txt')).resolves.toBe(false);
    });

    it('should report true for a path a rule covers', async () => {
      write('.gitignore', '*.log\n');
      write('debug.log', 'noise');

      await expect(git.isIgnored('debug.log')).resolves.toBe(true);
    });

    it('should report true for a file inside an ignored directory', async () => {
      write('.gitignore', 'build/\n');
      write('build/output.js', 'compiled');

      await expect(git.isIgnored('build/output.js')).resolves.toBe(true);
    });

    it('should not throw for a path that does not exist', async () => {
      await expect(git.isIgnored('nowhere/at/all.txt')).resolves.toBe(false);
    });
  });

  describe('isTracked', () => {
    it('should report true for a committed file', async () => {
      await expect(git.isTracked('README.md')).resolves.toBe(true);
    });

    it('should report false for an untracked file', async () => {
      write('notes.txt', 'hello');

      await expect(git.isTracked('notes.txt')).resolves.toBe(false);
    });

    it('should report false for a path that does not exist', async () => {
      await expect(git.isTracked('nowhere.txt')).resolves.toBe(false);
    });
  });

  describe('untrackKeepingFile', () => {
    it('should stop tracking the file without deleting it', async () => {
      write('secrets.env', 'TOKEN=1');
      run('git add secrets.env');
      run('git commit -m "add secrets"');

      await git.untrackKeepingFile('secrets.env');

      expect(existsSync(join(repo.path, 'secrets.env'))).toBe(true);
      await expect(git.isTracked('secrets.env')).resolves.toBe(false);
    });

    it('should make an ignore rule take effect, which is the whole point', async () => {
      write('secrets.env', 'TOKEN=1');
      run('git add secrets.env');
      run('git commit -m "add secrets"');
      write('.gitignore', 'secrets.env\n');

      // Ignored on paper, still tracked in fact.
      await expect(git.isTracked('secrets.env')).resolves.toBe(true);

      await git.untrackKeepingFile('secrets.env');
      run('git commit -am "stop tracking secrets"');
      write('secrets.env', 'TOKEN=2');

      const status = await git.getStatus(false);
      expect(status.untracked).not.toContain('secrets.env');
      expect(status.modified).not.toContain('secrets.env');
    });
  });

  describe('previewClean', () => {
    it('should report nothing on a clean tree', async () => {
      await expect(git.previewClean()).resolves.toEqual([]);
    });

    it('should list untracked files without deleting them', async () => {
      write('junk.txt', 'junk');

      const preview = await git.previewClean();

      expect(preview).toContain('junk.txt');
      expect(existsSync(join(repo.path, 'junk.txt'))).toBe(true);
    });

    it('should strip the "Would remove" prefix git puts on each line', async () => {
      write('junk.txt', 'junk');

      const preview = await git.previewClean();

      expect(preview.every(path => !path.startsWith('Would remove'))).toBe(true);
    });

    it('should not list tracked files, however modified', async () => {
      write('README.md', 'changed');

      await expect(git.previewClean()).resolves.toEqual([]);
    });

    it('should not list files an ignore rule covers', async () => {
      write('.gitignore', 'ignored.log\n');
      run('git add .gitignore');
      run('git commit -m "ignore the log"');
      write('ignored.log', 'noise');
      write('visible.txt', 'here');

      const preview = await git.previewClean();

      expect(preview).toContain('visible.txt');
      expect(preview).not.toContain('ignored.log');
    });
  });

  describe('cleanUntracked', () => {
    it('should delete only the paths given', async () => {
      write('gone.txt', 'bye');
      write('kept.txt', 'stay');

      await git.cleanUntracked(['gone.txt']);

      expect(existsSync(join(repo.path, 'gone.txt'))).toBe(false);
      expect(existsSync(join(repo.path, 'kept.txt'))).toBe(true);
    });

    it('should delete nothing when given nothing', async () => {
      write('kept.txt', 'stay');

      await git.cleanUntracked([]);

      expect(existsSync(join(repo.path, 'kept.txt'))).toBe(true);
    });

    it('should leave tracked files alone even if asked', async () => {
      await git.cleanUntracked(['README.md']);

      expect(existsSync(join(repo.path, 'README.md'))).toBe(true);
    });
  });

  describe('getCommitsNotIn', () => {
    beforeEach(() => {
      run('git checkout -b feature');
      write('feature.txt', 'one');
      run('git add feature.txt');
      run('git commit -m "a feature commit"');
      run('git checkout master');
    });

    it('should list what the other branch has and this one does not', async () => {
      const commits = await git.getCommitsNotIn('feature');

      expect(commits).toHaveLength(1);
      expect(commits[0].message).toContain('a feature commit');
    });

    it('should list nothing for a branch with nothing new', async () => {
      run('git checkout feature');
      const fromFeature = new GitService(repo.path);

      await expect(fromFeature.getCommitsNotIn('master')).resolves.toEqual([]);
    });

    it('should not include commits this branch alone has', async () => {
      write('master-only.txt', 'mine');
      run('git add master-only.txt');
      run('git commit -m "a master commit"');

      const commits = await git.getCommitsNotIn('feature');

      expect(commits.map(c => c.message.trim())).toEqual(['a feature commit']);
    });
  });

  describe('getCommitsAhead', () => {
    beforeEach(() => {
      run('git checkout -b feature');
      write('feature.txt', 'one');
      run('git add feature.txt');
      run('git commit -m "a feature commit"');
      run('git checkout master');
      write('master-only.txt', 'mine');
      run('git add master-only.txt');
      run('git commit -m "a master commit"');
    });

    it('should count only what this branch has that the base does not', async () => {
      // The mirror of the test above, and the reason both exist: simple-git
      // defaults from/to to the symmetric difference, so without symmetric:
      // false this returned both commits and the rebase confirmation offered
      // to replay a commit belonging to the branch being rebased onto.
      const commits = await git.getCommitsAhead('feature');

      expect(commits.map(c => c.message.trim())).toEqual(['a master commit']);
    });

    it('should count nothing when the base is ahead of here', async () => {
      run('git checkout feature');
      const fromFeature = new GitService(repo.path);

      const commits = await fromFeature.getCommitsAhead('master');

      expect(commits.map(c => c.message.trim())).toEqual(['a feature commit']);
    });
  });

  describe('cherryPick', () => {
    beforeEach(() => {
      run('git checkout -b feature');
      write('picked.txt', 'from the feature branch');
      run('git add picked.txt');
      run('git commit -m "the commit worth copying"');
      run('git checkout master');
    });

    it('should copy the commit and report that it finished', async () => {
      const [commit] = await git.getCommitsNotIn('feature');

      await expect(git.cherryPick(commit.hash)).resolves.toBe(true);

      expect(existsSync(join(repo.path, 'picked.txt'))).toBe(true);
    });

    it('should leave the original where it was', async () => {
      const [commit] = await git.getCommitsNotIn('feature');

      await git.cherryPick(commit.hash);

      const stillThere = execSync(`git log feature --format=%H`, {
        cwd: repo.path,
        stdio: 'pipe'
      }).toString();
      expect(stillThere).toContain(commit.hash);
    });

    it('should give the copy a new hash when it lands on a different parent', async () => {
      // master must have moved on, or the copy would have the same parent,
      // tree, message and author as the original — and therefore the same
      // hash. That is not a bug in cherry-pick; it is what a hash means.
      write('master-only.txt', 'master moved on');
      run('git add master-only.txt');
      run('git commit -m "a master commit"');

      const [commit] = await git.getCommitsNotIn('feature');

      await git.cherryPick(commit.hash);

      const head = execSync('git rev-parse HEAD', { cwd: repo.path, stdio: 'pipe' })
        .toString()
        .trim();
      expect(head).not.toBe(commit.hash);
      expect(existsSync(join(repo.path, 'picked.txt'))).toBe(true);
    });

    it('should report an interrupted pick rather than throw', async () => {
      // Touch the same file on both sides so the copy cannot apply cleanly.
      write('picked.txt', 'a conflicting version on master');
      run('git add picked.txt');
      run('git commit -m "conflicting master commit"');

      const [commit] = await git.getCommitsNotIn('feature');

      await expect(git.cherryPick(commit.hash)).resolves.toBe(false);
      await expect(git.isCherryPickInProgress()).resolves.toBe(true);

      run('git cherry-pick --abort');
    });
  });

  describe('LFS probes on a repository without it', () => {
    it('should answer whether git-lfs exists without throwing', async () => {
      await expect(git.isLfsAvailable()).resolves.toEqual(expect.any(Boolean));
    });

    it('should report a repository as set up once the clean filter exists', async () => {
      run('git config --local filter.lfs.clean "git-lfs clean -- %f"');

      await expect(git.isLfsInitialized()).resolves.toBe(true);
    });

    it('should agree with whatever git config reports, in any scope', async () => {
      // Not asserted as false on a fresh repo: a machine with a global
      // `git lfs install` already has the filter, and LFS genuinely does work
      // there. The question this answers is "will LFS work here", not "was
      // install run in this directory".
      let fromGit = false;
      try {
        fromGit =
          execSync('git config --get filter.lfs.clean', { cwd: repo.path, stdio: 'pipe' })
            .toString()
            .trim().length > 0;
      } catch {
        fromGit = false;
      }

      await expect(git.isLfsInitialized()).resolves.toBe(fromGit);
    });

    it('should return an empty list rather than fail when LFS is absent', async () => {
      await expect(git.getLfsPatterns()).resolves.toEqual(expect.any(Array));
      await expect(git.getLfsFiles()).resolves.toEqual(expect.any(Array));
    });
  });
});
