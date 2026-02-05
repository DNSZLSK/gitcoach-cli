import { simpleGit, SimpleGit, StatusResult, BranchSummary, LogResult, DiffResult } from 'simple-git';
import { existsSync } from 'fs';
import { join } from 'path';
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

export interface CommitInfo {
  hash: string;
  date: string;
  message: string;
  author: string;
}

const STATUS_CACHE_TTL_MS = 2000;

class GitService {
  private git: SimpleGit;
  private statusCache: { data: GitStatus; timestamp: number } | null = null;

  constructor(basePath?: string) {
    this.git = simpleGit(basePath || process.cwd());
  }

  setWorkingDirectory(path: string): void {
    this.git = simpleGit(path);
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
      staged: [...status.staged, ...status.created.filter(f => status.staged.includes(f))],
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

  async pull(remote: string = 'origin', branch?: string): Promise<void> {
    const currentBranch = branch || (await this.getCurrentBranch());
    if (!currentBranch) {
      throw new Error('Cannot pull: no branch specified and detached HEAD');
    }

    await this.git.pull(remote, currentBranch);
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
    const log: LogResult = await this.git.log({ maxCount });
    return log.all.map(entry => ({
      hash: entry.hash,
      date: entry.date,
      message: entry.message,
      author: entry.author_name
    }));
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
  }

  async stashDrop(index: number = 0): Promise<void> {
    await this.git.stash(['drop', `stash@{${index}}`]);
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
      const gitDir = join(process.cwd(), '.git', 'MERGE_HEAD');
      return existsSync(gitDir);
    } catch {
      logger.debug('Failed to check merge-in-progress state');
      return false;
    }
  }

  async isRebaseInProgress(): Promise<boolean> {
    try {
      const cwd = process.cwd();
      return existsSync(join(cwd, '.git', 'rebase-merge')) ||
             existsSync(join(cwd, '.git', 'rebase-apply'));
    } catch {
      logger.debug('Failed to check rebase-in-progress state');
      return false;
    }
  }

  async isCherryPickInProgress(): Promise<boolean> {
    try {
      return existsSync(join(process.cwd(), '.git', 'CHERRY_PICK_HEAD'));
    } catch {
      logger.debug('Failed to check cherry-pick-in-progress state');
      return false;
    }
  }

  async isBisectInProgress(): Promise<boolean> {
    try {
      return existsSync(join(process.cwd(), '.git', 'BISECT_LOG'));
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
}

export const gitService = new GitService();
export default gitService;
