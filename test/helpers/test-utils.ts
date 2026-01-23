/**
 * Test utilities for GitCoach integration tests
 */

import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';

export interface TestRepo {
  path: string;
  cleanup: () => void;
  createFile: (name: string, content?: string) => void;
  modifyFile: (name: string, content: string) => void;
  deleteFile: (name: string) => void;
  git: (command: string) => string;
  commitAll: (message: string) => void;
}

/**
 * Create a temporary test repository
 */
export function createTestRepo(name: string = 'test-repo'): TestRepo {
  const basePath = join(tmpdir(), 'gitcoach-tests', `${name}-${Date.now()}`);

  // Create directory
  mkdirSync(basePath, { recursive: true });

  // Initialize git repo
  execSync('git init', { cwd: basePath, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: basePath, stdio: 'pipe' });
  execSync('git config user.name "Test User"', { cwd: basePath, stdio: 'pipe' });

  const repo: TestRepo = {
    path: basePath,

    cleanup: () => {
      try {
        rmSync(basePath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    },

    createFile: (name: string, content: string = 'test content') => {
      const filePath = join(basePath, name);
      const dir = join(basePath, ...name.split('/').slice(0, -1));
      if (dir !== basePath) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(filePath, content);
    },

    modifyFile: (name: string, content: string) => {
      writeFileSync(join(basePath, name), content);
    },

    deleteFile: (name: string) => {
      rmSync(join(basePath, name));
    },

    git: (command: string): string => {
      return execSync(`git ${command}`, { cwd: basePath, stdio: 'pipe' }).toString().trim();
    },

    commitAll: (message: string) => {
      execSync('git add -A', { cwd: basePath, stdio: 'pipe' });
      execSync(`git commit -m "${message}"`, { cwd: basePath, stdio: 'pipe' });
    }
  };

  return repo;
}

/**
 * Create a bare repository (for remote simulation)
 */
export function createBareRepo(name: string = 'bare-repo'): { path: string; cleanup: () => void } {
  const basePath = join(tmpdir(), 'gitcoach-tests', `${name}-bare-${Date.now()}`);

  mkdirSync(basePath, { recursive: true });
  execSync('git init --bare', { cwd: basePath, stdio: 'pipe' });

  return {
    path: basePath,
    cleanup: () => {
      try {
        rmSync(basePath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  };
}

/**
 * Create a test repo with an initial commit
 */
export function createTestRepoWithCommit(name?: string): TestRepo {
  const repo = createTestRepo(name);
  repo.createFile('README.md', '# Test Repository');
  repo.commitAll('Initial commit');
  return repo;
}

/**
 * Create a test repo connected to a remote
 */
export function createTestRepoWithRemote(name?: string): { repo: TestRepo; remote: { path: string; cleanup: () => void } } {
  const remote = createBareRepo(`${name || 'test'}-remote`);
  const repo = createTestRepoWithCommit(name);

  repo.git(`remote add origin "${remote.path}"`);
  repo.git('push -u origin main 2>&1 || git push -u origin master 2>&1');

  return { repo, remote };
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error('Timeout waiting for condition');
}

/**
 * Create a directory that is NOT a git repo
 */
export function createNonGitDir(name: string = 'non-git'): { path: string; cleanup: () => void } {
  const basePath = join(tmpdir(), 'gitcoach-tests', `${name}-${Date.now()}`);
  mkdirSync(basePath, { recursive: true });

  return {
    path: basePath,
    cleanup: () => {
      try {
        rmSync(basePath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  };
}

/**
 * Check if a file exists in a repo
 */
export function fileExists(repoPath: string, fileName: string): boolean {
  return existsSync(join(repoPath, fileName));
}
