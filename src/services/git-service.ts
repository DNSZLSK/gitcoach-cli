import { simpleGit, SimpleGit, StatusResult, BranchSummary, LogResult, DiffResult } from 'simple-git';

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

class GitService {
  private git: SimpleGit;

  constructor(basePath?: string) {
    this.git = simpleGit(basePath || process.cwd());
  }

  setWorkingDirectory(path: string): void {
    this.git = simpleGit(path);
  }

  async isGitRepo(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<GitStatus> {
    const status: StatusResult = await this.git.status();

    return {
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
  }

  async addAll(): Promise<void> {
    await this.git.add('-A');
  }

  async commit(message: string): Promise<string> {
    const result = await this.git.commit(message);
    return result.commit;
  }

  async push(remote: string = 'origin', branch?: string, force: boolean = false): Promise<void> {
    const currentBranch = branch || (await this.getCurrentBranch());
    if (!currentBranch) {
      throw new Error('Cannot push: no branch specified and detached HEAD');
    }

    const options = force ? ['--force'] : [];
    await this.git.push(remote, currentBranch, options);
  }

  async pull(remote: string = 'origin', branch?: string): Promise<void> {
    const currentBranch = branch || (await this.getCurrentBranch());
    if (!currentBranch) {
      throw new Error('Cannot pull: no branch specified and detached HEAD');
    }

    await this.git.pull(remote, currentBranch);
  }

  async checkout(branch: string): Promise<void> {
    await this.git.checkout(branch);
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

  async fetch(remote: string = 'origin'): Promise<void> {
    await this.git.fetch(remote);
  }

  async reset(mode: 'soft' | 'mixed' | 'hard' = 'mixed', ref: string = 'HEAD'): Promise<void> {
    await this.git.reset([`--${mode}`, ref]);
  }

  async stash(message?: string): Promise<void> {
    if (message) {
      await this.git.stash(['push', '-m', message]);
    } else {
      await this.git.stash();
    }
  }

  async stashPop(): Promise<void> {
    await this.git.stash(['pop']);
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
