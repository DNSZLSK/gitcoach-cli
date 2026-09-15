import { simpleGit, SimpleGit, StatusResult, BranchSummary, LogResult, DiffResult } from 'simple-git';
import { existsSync, statSync, readFileSync } from 'fs';
import { join, resolve, isAbsolute } from 'path';
import { logger } from '../utils/logger.js';

export interface GitStatus {
  isClean: boolean;
  current: string | null;
  tracking: string | null;
  staged: string[];
  modified: string[];
  deleted: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

export interface BranchInfo {
  name: string;
  current: boolean;
  commit: string;
  label: string;
}

export interface TagInfo {
  name: string;
  annotated: boolean;
  commit: string;
  message: string;
  date: string;
}

export interface CommitInfo {
  hash: string;
  date: string;
  message: string;
  author: string;
}

const STATUS_CACHE_TTL_MS = 2000;

export class GitService {
  private git: SimpleGit;
  private statusCache: { data: GitStatus; timestamp: number } | null = null;
  private basePath: string;
  private gitDirCache: string | null = null;

  constructor(basePath?: string) {
    this.basePath = basePath || process.cwd();
    this.git = simpleGit(this.basePath);
  }

  /**
   * Resolve the absolute path to the repository's .git directory.
   * Uses `git rev-parse --git-dir` so it works from a subdirectory and with
   * worktrees/submodules, instead of assuming `cwd/.git`.
   */
  private async getGitDir(): Promise<string> {
    if (this.gitDirCache) {
      return this.gitDirCache;
    }
    const raw = (await this.git.revparse(['--git-dir'])).trim();
    this.gitDirCache = isAbsolute(raw) ? raw : resolve(this.basePath, raw);
    return this.gitDirCache;
  }

  setWorkingDirectory(path: string): void {
    this.basePath = path;
    this.git = simpleGit(path);
    this.gitDirCache = null;
    this.invalidateCache();
  }

  invalidateCache(): void {
    this.statusCache = null;
  }

  async isGitRepo(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      logger.debug('Not a git repository or git status failed');
      return false;
    }
  }

  async getStatus(useCache: boolean = true): Promise<GitStatus> {
    if (useCache && this.statusCache && (Date.now() - this.statusCache.timestamp) < STATUS_CACHE_TTL_MS) {
      return this.statusCache.data;
    }

    const status: StatusResult = await this.git.status();

    const result: GitStatus = {
      isClean: status.isClean(),
      current: status.current,
      tracking: status.tracking,
      staged: [...status.staged, ...status.created.filter(f => !status.staged.includes(f))],
      modified: status.modified.filter(f => !status.staged.includes(f)),
      deleted: status.deleted,
      untracked: status.not_added,
      ahead: status.ahead,
      behind: status.behind
    };

    this.statusCache = { data: result, timestamp: Date.now() };
    return result;
  }

  async getRawStatus(): Promise<StatusResult> {
    return this.git.status();
  }

  async getCurrentBranch(): Promise<string | null> {
    const status = await this.git.status();
    return status.current;
  }

  async isDetachedHead(): Promise<boolean> {
    const status = await this.git.status();
    return status.current === null || status.detached;
  }

  async getBranches(): Promise<BranchInfo[]> {
    const summary: BranchSummary = await this.git.branch();
    const branches: BranchInfo[] = [];

    for (const [name, data] of Object.entries(summary.branches)) {
      branches.push({
        name,
        current: data.current,
        commit: data.commit,
        label: data.label
      });
    }

    return branches;
  }

  async getLocalBranches(): Promise<BranchInfo[]> {
    const summary: BranchSummary = await this.git.branch();
    const branches: BranchInfo[] = [];

    for (const [name, data] of Object.entries(summary.branches)) {
      // Filter out remote branches (start with remotes/ or contain /)
      if (!name.startsWith('remotes/') && !name.includes('/')) {
        branches.push({
          name,
          current: data.current,
          commit: data.commit,
          label: data.label
        });
      }
    }

    return branches;
  }

  async getStagedFiles(): Promise<string[]> {
    const status = await this.git.status();
    return [...status.staged, ...status.created];
  }

  async getUnstagedFiles(): Promise<string[]> {
    const status = await this.git.status();
    return [...status.modified, ...status.deleted, ...status.not_added];
  }

  async hasUncommittedChanges(): Promise<boolean> {
    const status = await this.git.status();
    return !status.isClean();
  }

  async getDiff(staged: boolean = false): Promise<string> {
    if (staged) {
      return this.git.diff(['--cached']);
    }
    return this.git.diff();
  }

  async getDiffSummary(staged: boolean = false): Promise<DiffResult> {
    if (staged) {
      return this.git.diffSummary(['--cached']);
    }
    return this.git.diffSummary();
  }

  async add(files: string | string[]): Promise<void> {
    const fileList = Array.isArray(files) ? files : [files];
    await this.git.add(fileList);
    this.invalidateCache();
  }

  async addAll(): Promise<void> {
    await this.git.add('-A');
    this.invalidateCache();
  }

  async commit(message: string): Promise<string> {
    const result = await this.git.commit(message);
    this.invalidateCache();
    return result.commit;
  }

  async commitNoEdit(): Promise<string> {
    try {
      const result = await this.git.raw(['commit', '--no-edit']);
      this.invalidateCache();
      // Extract commit hash from output (e.g., "[main abc1234] Merge ...")
      const match = result.match(/\[[\w/.-]+\s+([a-f0-9]+)\]/);
      return match ? match[1] : 'unknown';
    } catch {
      // Fallback: commit with explicit merge message
      const result = await this.git.commit('Merge remote changes');
      this.invalidateCache();
      return result.commit;
    }
  }

  async push(remote: string = 'origin', branch?: string, force: boolean = false, setUpstream: boolean = false): Promise<void> {
    const currentBranch = branch || (await this.getCurrentBranch());
    if (!currentBranch) {
      throw new Error('Cannot push: no branch specified and detached HEAD');
    }

    const options: string[] = [];
    if (force) options.push('--force');
    if (setUpstream) options.push('-u');
    await this.git.push(remote, currentBranch, options);
    this.invalidateCache();
  }

  /**
   * Check if there are local commits that haven't been pushed
   * Works even when there's no upstream branch set
   */
  async hasUnpushedCommits(): Promise<boolean> {
    try {
      const status = await this.git.status();

      // If tracking is set, use ahead count
      if (status.tracking) {
        return status.ahead > 0;
      }

      // No tracking branch - check if there are any commits at all
      const log = await this.git.log({ maxCount: 1 });
      return log.total > 0;
    } catch {
      logger.debug('Failed to check for unpushed commits');
      return false;
    }
  }

  /**
   * Get the number of unpushed commits
   * Returns -1 if no upstream is set (meaning all commits are unpushed)
   */
  async getUnpushedCommitCount(): Promise<number> {
    try {
      const status = await this.git.status();

      // If tracking is set, return ahead count
      if (status.tracking) {
        return status.ahead;
      }

      // No tracking branch - count all local commits
      const log = await this.git.log();
      return log.total;
    } catch {
      logger.debug('Failed to get unpushed commit count');
      return 0;
    }
  }

  async pull(remote: string = 'origin', branch?: string, options?: Record<string, null>): Promise<void> {
    const currentBranch = branch || (await this.getCurrentBranch());
    if (!currentBranch) {
      throw new Error('Cannot pull: no branch specified and detached HEAD');
    }

    if (options) {
      const optionFlags = Object.keys(options);
      await this.git.pull(remote, currentBranch, optionFlags);
    } else {
      await this.git.pull(remote, currentBranch);
    }
    this.invalidateCache();
  }

  async checkout(branch: string): Promise<void> {
    await this.git.checkout(branch);
    this.invalidateCache();
  }

  async createBranch(name: string, checkout: boolean = true): Promise<void> {
    if (checkout) {
      await this.git.checkoutLocalBranch(name);
    } else {
      await this.git.branch([name]);
    }
  }

  async deleteBranch(name: string, force: boolean = false): Promise<void> {
    const options = force ? ['-D', name] : ['-d', name];
    await this.git.branch(options);
  }

  async merge(branch: string): Promise<void> {
    await this.git.merge([branch, '--no-edit']);
    this.invalidateCache();
  }

  async hasConflicts(): Promise<boolean> {
    const status = await this.git.status();
    return status.conflicted.length > 0;
  }

  async getConflictedFiles(): Promise<string[]> {
    const status = await this.git.status();
    return status.conflicted;
  }

  async getLog(maxCount: number = 10): Promise<CommitInfo[]> {
    try {
      const log: LogResult = await this.git.log({ maxCount });
      return log.all.map(entry => ({
        hash: entry.hash,
        date: entry.date,
        message: entry.message,
        author: entry.author_name
      }));
    } catch {
      // Empty repository (no commits yet) or log unavailable
      logger.debug('getLog failed (likely empty repository)');
      return [];
    }
  }

  async getRemotes(): Promise<string[]> {
    const remotes = await this.git.getRemotes();
    return remotes.map(r => r.name);
  }

  async hasRemote(): Promise<boolean> {
    const remotes = await this.getRemotes();
    return remotes.length > 0;
  }

  async getRemoteUrl(name: string = 'origin'): Promise<string | null> {
    try {
      const remotes = await this.git.getRemotes(true);
      const remote = remotes.find(r => r.name === name);
      return remote?.refs?.push || remote?.refs?.fetch || null;
    } catch {
      logger.debug('Failed to get remote URL');
      return null;
    }
  }

  async removeRemote(name: string): Promise<void> {
    await this.git.removeRemote(name);
  }

  async fetch(remote: string = 'origin'): Promise<void> {
    await this.git.fetch(remote);
    this.invalidateCache();
  }

  async reset(mode: 'soft' | 'mixed' | 'hard' = 'mixed', ref: string = 'HEAD'): Promise<void> {
    await this.git.reset([`--${mode}`, ref]);
    this.invalidateCache();
  }

  async stash(message?: string): Promise<void> {
    if (message) {
      await this.git.stash(['push', '-m', message]);
    } else {
      await this.git.stash();
    }
    this.invalidateCache();
  }

  async stashPop(): Promise<void> {
    await this.git.stash(['pop']);
    this.invalidateCache();
  }

  async stashApply(index: number = 0): Promise<void> {
    await this.git.stash(['apply', `stash@{${index}}`]);
    this.invalidateCache();
  }

  async stashDrop(index: number = 0): Promise<void> {
    await this.git.stash(['drop', `stash@{${index}}`]);
    this.invalidateCache();
  }

  async getStashList(): Promise<string[]> {
    const result = await this.git.stash(['list']);
    if (!result) return [];
    return result.split('\n').filter(line => line.trim());
  }

  async getFileContent(file: string, ref: string = 'HEAD'): Promise<string> {
    return this.git.show([`${ref}:${file}`]);
  }

  async init(): Promise<void> {
    await this.git.init();
  }

  async addRemote(name: string, url: string): Promise<void> {
    await this.git.addRemote(name, url);
  }

  async isMergeInProgress(): Promise<boolean> {
    try {
      return existsSync(join(await this.getGitDir(), 'MERGE_HEAD'));
    } catch {
      logger.debug('Failed to check merge-in-progress state');
      return false;
    }
  }

  async isRebaseInProgress(): Promise<boolean> {
    try {
      const gitDir = await this.getGitDir();
      return existsSync(join(gitDir, 'rebase-merge')) ||
             existsSync(join(gitDir, 'rebase-apply'));
    } catch {
      logger.debug('Failed to check rebase-in-progress state');
      return false;
    }
  }

  async isCherryPickInProgress(): Promise<boolean> {
    try {
      return existsSync(join(await this.getGitDir(), 'CHERRY_PICK_HEAD'));
    } catch {
      logger.debug('Failed to check cherry-pick-in-progress state');
      return false;
    }
  }

  async isBisectInProgress(): Promise<boolean> {
    try {
      return existsSync(join(await this.getGitDir(), 'BISECT_LOG'));
    } catch {
      logger.debug('Failed to check bisect-in-progress state');
      return false;
    }
  }

  async abortMerge(): Promise<void> {
    await this.git.merge(['--abort']);
    this.invalidateCache();
  }

  async abortRebase(): Promise<void> {
    await this.git.rebase(['--abort']);
    this.invalidateCache();
  }

  /**
   * Resume a rebase once its conflicts are resolved.
   *
   * Returns whether the rebase actually finished. simple-git resolves rather
   * than rejects when `rebase --continue` exits non-zero, putting git's refusal
   * in the output, so the outcome has to be read from the repository state.
   * A rebase that clears one conflict only to stop on the next also returns
   * false: it has not finished, and the caller must say so.
   *
   * `-c core.editor=true` stops git opening an editor for the commit message,
   * passed per-invocation so the setting does not leak into later commands.
   */
  async continueRebase(): Promise<boolean> {
    return this.resumeOperation(
      ['-c', 'core.editor=true', 'rebase', '--continue'],
      () => this.isRebaseInProgress()
    );
  }

  /**
   * Run a `--continue` and report whether the operation actually finished.
   *
   * These commands are inconsistent through simple-git: a failed
   * `rebase --continue` resolves with git's refusal in the output, while a
   * failed `cherry-pick --continue` rejects. Both mean the same thing, so the
   * refusal is absorbed here and the answer is read from the repository. A
   * genuine error, one that leaves no operation in progress, still propagates.
   */
  private async resumeOperation(
    args: string[],
    stillRunning: () => Promise<boolean>
  ): Promise<boolean> {
    try {
      await this.git.raw(args);
    } catch (error) {
      this.invalidateCache();
      if (await stillRunning()) {
        logger.debug('Operation refused to continue, probably unresolved conflicts');
        return false;
      }
      throw error;
    }

    this.invalidateCache();
    return !(await stillRunning());
  }

  /**
   * Drop the commit a rebase is stuck on and move to the next one.
   */
  /**
   * Replay the current branch on top of another.
   *
   * Returns whether it finished. A rebase that stops on a conflict is not an
   * error, it is the normal interrupted state the in-progress flow handles, so
   * it comes back as false rather than as a rejection.
   */
  async rebaseOnto(branch: string): Promise<boolean> {
    return this.resumeOperation(
      ['-c', 'core.editor=true', 'rebase', branch],
      () => this.isRebaseInProgress()
    );
  }

  /**
   * Squash the last `count` commits into one.
   *
   * Implemented with a soft reset plus a fresh commit rather than an
   * interactive rebase: the result is identical and it needs no editor
   * scripting, which cannot be driven reliably from a menu.
   */
  async squashCommits(count: number, message: string): Promise<void> {
    if (count < 2) {
      throw new Error('Squashing needs at least two commits');
    }
    await this.git.reset(['--soft', `HEAD~${count}`]);
    await this.git.commit(message);
    this.invalidateCache();
  }

  /**
   * Commits on this branch that are not on `base`, newest first.
   */
  async getCommitsAhead(base: string, maxCount: number = 50): Promise<CommitInfo[]> {
    const log = await this.git.log({ from: base, to: 'HEAD', maxCount });
    return log.all.map(entry => ({
      hash: entry.hash,
      date: entry.date,
      message: entry.message,
      author: entry.author_name
    }));
  }

  async skipRebase(): Promise<void> {
    await this.git.rebase(['--skip']);
    this.invalidateCache();
  }

  /**
   * Resume a cherry-pick. Like continueRebase, the outcome is read from the
   * repository rather than from a thrown error.
   */
  async continueCherryPick(): Promise<boolean> {
    return this.resumeOperation(
      ['-c', 'core.editor=true', 'cherry-pick', '--continue'],
      () => this.isCherryPickInProgress()
    );
  }

  async abortCherryPick(): Promise<void> {
    await this.git.raw(['cherry-pick', '--abort']);
    this.invalidateCache();
  }

  async abortBisect(): Promise<void> {
    await this.git.raw(['bisect', 'reset']);
    this.invalidateCache();
  }

  /**
   * How far a rebase has got, as "step of total".
   *
   * git keeps these counters in the rebase state directory; they are absent for
   * an interrupted `rebase --apply`, so callers must tolerate null.
   */
  async getRebaseProgress(): Promise<{ current: number; total: number } | null> {
    try {
      const dir = join(await this.getGitDir(), 'rebase-merge');
      if (!existsSync(dir)) {
        return null;
      }
      const current = Number(readFileSync(join(dir, 'msgnum'), 'utf-8').trim());
      const total = Number(readFileSync(join(dir, 'end'), 'utf-8').trim());
      if (!Number.isFinite(current) || !Number.isFinite(total)) {
        return null;
      }
      return { current, total };
    } catch {
      logger.debug('Failed to read rebase progress');
      return null;
    }
  }

  async hasUpstream(branch?: string): Promise<boolean> {
    try {
      const status = await this.git.status();
      if (branch && branch !== status.current) {
        // Check specific branch tracking
        const branchSummary = await this.git.branch(['-vv']);
        const branchInfo = branchSummary.branches[branch];
        return branchInfo?.label?.includes('[') ?? false;
      }
      return !!status.tracking;
    } catch {
      logger.debug('Failed to check upstream status');
      return false;
    }
  }

  async clone(repoUrl: string, directory?: string): Promise<void> {
    if (directory) {
      await this.git.clone(repoUrl, directory);
    } else {
      await this.git.clone(repoUrl);
    }
  }

  /**
   * Read the effective git identity (local overrides global). Returns null for
   * a field that is not configured anywhere.
   */
  async getUserIdentity(): Promise<{ name: string | null; email: string | null }> {
    const read = async (key: string): Promise<string | null> => {
      try {
        const value = (await this.git.raw(['config', key])).trim();
        return value.length > 0 ? value : null;
      } catch {
        // `git config <key>` exits non-zero when the key is unset
        return null;
      }
    };
    return { name: await read('user.name'), email: await read('user.email') };
  }

  async setUserIdentity(name: string, email: string, global: boolean = false): Promise<void> {
    const scope = global ? ['--global'] : [];
    await this.git.raw(['config', ...scope, 'user.name', name]);
    await this.git.raw(['config', ...scope, 'user.email', email]);
  }

  /** Staged files whose on-disk size exceeds maxBytes (staged-deleted files are skipped). */
  async getLargeStagedFiles(maxBytes: number): Promise<string[]> {
    const staged = await this.getStagedFiles();
    const large: string[] = [];
    for (const file of staged) {
      try {
        const stats = statSync(join(this.basePath, file));
        if (stats.isFile() && stats.size > maxBytes) {
          large.push(file);
        }
      } catch {
        // staged-deleted or unreadable — not a large-file risk
      }
    }
    return large;
  }

  async getReflog(maxCount: number = 30): Promise<Array<{ hash: string; ref: string; message: string }>> {
    try {
      const raw = await this.git.raw([
        'reflog',
        '--no-color',
        '--format=%h%x09%gd%x09%gs',
        '-n',
        String(maxCount)
      ]);
      return raw
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => {
          const [hash, ref, ...rest] = line.split('\t');
          return {
            hash: (hash || '').trim(),
            ref: (ref || '').trim(),
            message: rest.join('\t').trim()
          };
        });
    } catch {
      logger.debug('Failed to read reflog');
      return [];
    }
  }

  async createBranchAt(name: string, ref: string): Promise<void> {
    await this.git.branch([name, ref]);
  }

  /**
   * Tags, newest first.
   *
   * `--sort=-creatordate` covers lightweight and annotated tags alike, unlike
   * `-version:refname`, which orders by name and misplaces anything that is not
   * strictly semver.
   */
  /**
   * Message of the most recent commit, or null in a repository with no commits.
   */
  async getLastCommitMessage(): Promise<string | null> {
    try {
      const message = await this.git.raw(['log', '-1', '--pretty=%B']);
      return message.trim() || null;
    } catch {
      logger.debug('No commit to read a message from');
      return null;
    }
  }

  /**
   * Replace the most recent commit.
   *
   * This creates a new commit object, so the old hash disappears. Callers must
   * warn first when the commit has already been pushed.
   */
  async amendCommit(message?: string): Promise<void> {
    const args = message
      ? ['commit', '--amend', '-m', message]
      : ['commit', '--amend', '--no-edit'];
    await this.git.raw(args);
    this.invalidateCache();
  }

  /**
   * Revert a commit by adding a new commit that undoes it. Unlike a reset this
   * keeps history intact, so it is safe on a shared branch.
   */
  async revertCommit(hash: string): Promise<void> {
    await this.git.raw(['revert', '--no-edit', hash]);
    this.invalidateCache();
  }

  async getTags(): Promise<TagInfo[]> {
    // Unit separator: Node rejects NUL bytes in process arguments, and 0x1F
    // cannot appear in a tag name, subject or date.
    const SEP = '\u001f';
    const format = ['%(refname:short)', '%(objecttype)', '%(objectname:short)',
      '%(contents:subject)', '%(creatordate:short)'].join(SEP);

    const raw = await this.git.raw(['for-each-ref', '--sort=-creatordate',
      `--format=${format}`, 'refs/tags']);

    return raw
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => {
        const [name, type, commit, message, date] = line.split(SEP);
        return {
          name,
          // An annotated tag is its own object; a lightweight one points
          // straight at the commit.
          annotated: type === 'tag',
          commit: commit || '',
          message: message || '',
          date: date || ''
        };
      });
  }

  async tagExists(name: string): Promise<boolean> {
    const tags = await this.getTags();
    return tags.some(tag => tag.name === name);
  }

  /**
   * Create a tag. A message produces an annotated tag, which records who made
   * it and when; without one the tag is lightweight and carries no metadata.
   */
  async createTag(name: string, message?: string, ref?: string): Promise<void> {
    const args = message
      ? ['tag', '-a', name, '-m', message]
      : ['tag', name];
    if (ref) {
      args.push(ref);
    }
    await this.git.raw(args);
  }

  async deleteTag(name: string): Promise<void> {
    await this.git.raw(['tag', '-d', name]);
  }

  async deleteRemoteTag(name: string, remote: string = 'origin'): Promise<void> {
    await this.git.push([remote, '--delete', name]);
  }

  async pushTag(name: string, remote: string = 'origin'): Promise<void> {
    await this.git.push([remote, name]);
  }

  async pushAllTags(remote: string = 'origin'): Promise<void> {
    await this.git.push([remote, '--tags']);
  }

  /**
   * Tags that exist locally but not on the remote.
   *
   * `ls-remote` is a network call, so callers should treat a failure here as
   * "unknown" rather than "nothing to push".
   */
  async getUnpushedTags(remote: string = 'origin'): Promise<string[]> {
    const raw = await this.git.raw(['ls-remote', '--tags', remote]);
    const remoteTags = new Set(
      raw
        .split('\n')
        .map(line => line.split('refs/tags/')[1])
        .filter((name): name is string => !!name)
        // ls-remote lists annotated tags twice, the second dereferenced with ^{}
        .map(name => name.replace(/\^\{\}$/, ''))
    );

    const local = await this.getTags();
    return local.filter(tag => !remoteTags.has(tag.name)).map(tag => tag.name);
  }
}

export const gitService = new GitService();
export default gitService;
