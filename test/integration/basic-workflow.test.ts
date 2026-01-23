/**
 * Integration tests for Basic Git Workflow
 * Tests: status, add, commit, push, pull
 */

import { createTestRepo, createTestRepoWithCommit, createTestRepoWithRemote } from '../helpers/test-utils.js';
import { createMockGitService, type MockGitService } from '../helpers/mock-git.js';
import { createMockPrompts, userFlow, type MockPrompts } from '../helpers/mock-prompts.js';

// Mock modules
jest.mock('../../src/services/git-service.js');
jest.mock('../../src/ui/components/prompt.js');

describe('Basic Workflow', () => {
  let mockGitService: MockGitService;
  let mockPrompts: MockPrompts;

  beforeEach(() => {
    mockGitService = createMockGitService();
    mockPrompts = createMockPrompts();
    jest.clearAllMocks();
  });

  describe('Status', () => {
    it('should show clean status when no changes', async () => {
      mockGitService.__setState({
        staged: [],
        modified: [],
        deleted: [],
        untracked: []
      });

      const status = await mockGitService.getStatus();

      expect(status.isClean).toBe(true);
      expect(status.staged).toHaveLength(0);
      expect(status.modified).toHaveLength(0);
    });

    it('should show modified files', async () => {
      mockGitService.__setState({
        modified: ['file1.txt', 'src/index.ts']
      });

      const status = await mockGitService.getStatus();

      expect(status.isClean).toBe(false);
      expect(status.modified).toContain('file1.txt');
      expect(status.modified).toContain('src/index.ts');
    });

    it('should show staged files', async () => {
      mockGitService.__setState({
        staged: ['staged-file.txt']
      });

      const status = await mockGitService.getStatus();

      expect(status.isClean).toBe(false);
      expect(status.staged).toContain('staged-file.txt');
    });

    it('should show untracked files', async () => {
      mockGitService.__setState({
        untracked: ['new-file.txt', 'another.js']
      });

      const status = await mockGitService.getStatus();

      expect(status.isClean).toBe(false);
      expect(status.untracked).toContain('new-file.txt');
    });

    it('should show ahead/behind counts', async () => {
      mockGitService.__setState({
        ahead: 3,
        behind: 1
      });

      const status = await mockGitService.getStatus();

      expect(status.ahead).toBe(3);
      expect(status.behind).toBe(1);
    });

    it('should show current branch', async () => {
      mockGitService.__setState({
        currentBranch: 'feature/test'
      });

      const status = await mockGitService.getStatus();

      expect(status.current).toBe('feature/test');
    });
  });

  describe('Add (Stage)', () => {
    it('should stage all files', async () => {
      mockGitService.__setState({
        modified: ['file1.txt', 'file2.txt'],
        untracked: ['new.txt']
      });

      const allFiles = ['file1.txt', 'file2.txt', 'new.txt'];
      await mockGitService.add(allFiles);

      expect(mockGitService.add).toHaveBeenCalledWith(allFiles);
      expect(mockGitService.__state.staged).toContain('file1.txt');
    });

    it('should stage specific files', async () => {
      mockGitService.__setState({
        modified: ['file1.txt', 'file2.txt', 'file3.txt'],
        untracked: []
      });

      await mockGitService.add(['file1.txt', 'file3.txt']);

      expect(mockGitService.add).toHaveBeenCalledWith(['file1.txt', 'file3.txt']);
    });

    it('should move files from modified to staged', async () => {
      mockGitService.__setState({
        modified: ['file.txt'],
        staged: []
      });

      await mockGitService.add(['file.txt']);

      expect(mockGitService.__state.staged).toContain('file.txt');
      expect(mockGitService.__state.modified).not.toContain('file.txt');
    });

    it('should handle user selecting files via checkbox', async () => {
      const responses = userFlow()
        .confirm(false)  // Don't stage all
        .checkbox(['file1.txt', 'file3.txt'])  // Select specific files
        .build();

      mockPrompts.__setResponses(responses);

      const stageAll = await mockPrompts.promptConfirm('Stage all?');
      expect(stageAll).toBe(false);

      const selectedFiles = await mockPrompts.promptCheckbox('Select files', []);
      expect(selectedFiles).toEqual(['file1.txt', 'file3.txt']);
    });
  });

  describe('Commit', () => {
    it('should commit with manual message', async () => {
      mockGitService.__setState({
        staged: ['file.txt']
      });

      const hash = await mockGitService.commit('feat: add new feature');

      expect(mockGitService.commit).toHaveBeenCalledWith('feat: add new feature');
      expect(hash).toBeDefined();
      expect(mockGitService.__state.commits).toHaveLength(1);
      expect(mockGitService.__state.staged).toHaveLength(0);
    });

    it('should increment ahead count after commit', async () => {
      mockGitService.__setState({
        staged: ['file.txt'],
        ahead: 0
      });

      await mockGitService.commit('test commit');

      expect(mockGitService.__state.ahead).toBe(1);
    });

    it('should handle commit flow with user input', async () => {
      const responses = userFlow()
        .confirm(false)  // Don't use AI
        .input('fix: resolve critical bug')  // Manual message
        .select('keep')  // Keep as-is (no conventional commit conversion)
        .build();

      mockPrompts.__setResponses(responses);

      const useAI = await mockPrompts.promptConfirm('Generate with AI?');
      expect(useAI).toBe(false);

      const message = await mockPrompts.promptInput('Commit message');
      expect(message).toBe('fix: resolve critical bug');
    });

    it('should handle AI-generated commit message', async () => {
      const responses = userFlow()
        .confirm(true)   // Use AI
        .confirm(true)   // Accept generated message
        .build();

      mockPrompts.__setResponses(responses);

      const useAI = await mockPrompts.promptConfirm('Generate with AI?');
      expect(useAI).toBe(true);

      const acceptMessage = await mockPrompts.promptConfirm('Use this message?');
      expect(acceptMessage).toBe(true);
    });

    it('should reject commit when no staged files', async () => {
      mockGitService.__setState({
        staged: []
      });

      const stagedFiles = await mockGitService.getStagedFiles();
      expect(stagedFiles).toHaveLength(0);
      // In real flow, this would show error and return
    });
  });

  describe('Push', () => {
    it('should push when there are unpushed commits', async () => {
      mockGitService.__setState({
        ahead: 2,
        tracking: 'origin/main'
      });

      await mockGitService.push('origin', 'main');

      expect(mockGitService.push).toHaveBeenCalledWith('origin', 'main');
      expect(mockGitService.__state.ahead).toBe(0);
    });

    it('should handle first push without upstream', async () => {
      mockGitService.__setState({
        tracking: null,
        commits: [
          { hash: 'abc123', date: '2024-01-01', message: 'Initial', author: 'Test' }
        ]
      });

      const hasUnpushed = await mockGitService.hasUnpushedCommits();
      expect(hasUnpushed).toBe(true);

      await mockGitService.push('origin', 'main', false, true);

      expect(mockGitService.push).toHaveBeenCalledWith('origin', 'main', false, true);
      expect(mockGitService.__state.tracking).toBe('origin/main');
    });

    it('should show nothing to push when up to date', async () => {
      mockGitService.__setState({
        ahead: 0,
        behind: 0,
        tracking: 'origin/main'
      });

      const hasUnpushed = await mockGitService.hasUnpushedCommits();
      expect(hasUnpushed).toBe(false);
    });

    it('should handle push confirmation', async () => {
      const responses = userFlow()
        .confirm(true)  // Confirm push
        .build();

      mockPrompts.__setResponses(responses);

      const confirmPush = await mockPrompts.promptConfirm('Push 2 commits?');
      expect(confirmPush).toBe(true);
    });
  });

  describe('Pull', () => {
    it('should pull when behind remote', async () => {
      mockGitService.__setState({
        behind: 3
      });

      await mockGitService.pull('origin', 'main');

      expect(mockGitService.pull).toHaveBeenCalled();
      expect(mockGitService.__state.behind).toBe(0);
    });

    it('should show up to date when nothing to pull', async () => {
      mockGitService.__setState({
        behind: 0
      });

      const status = await mockGitService.getStatus();
      expect(status.behind).toBe(0);
    });
  });
});

describe('Basic Workflow - Real Git', () => {
  // These tests use actual git operations

  it('should perform complete add-commit flow', () => {
    const repo = createTestRepo('real-workflow');

    try {
      // Create a file
      repo.createFile('test.txt', 'Hello World');

      // Check status - should show untracked
      const statusBefore = repo.git('status --porcelain');
      expect(statusBefore).toContain('?? test.txt');

      // Add file
      repo.git('add test.txt');

      // Check status - should show staged
      const statusAfterAdd = repo.git('status --porcelain');
      expect(statusAfterAdd).toContain('A  test.txt');

      // Commit
      repo.git('commit -m "Add test file"');

      // Check status - should be clean
      const statusAfterCommit = repo.git('status --porcelain');
      expect(statusAfterCommit).toBe('');
    } finally {
      repo.cleanup();
    }
  });

  it('should track multiple file states correctly', () => {
    const repo = createTestRepoWithCommit('multi-state');

    try {
      // Create files with different states
      repo.createFile('untracked.txt', 'new file');
      repo.modifyFile('README.md', '# Modified');
      repo.createFile('staged.txt', 'to be staged');
      repo.git('add staged.txt');

      const status = repo.git('status --porcelain');

      expect(status).toContain('A  staged.txt');    // Staged
      expect(status).toMatch(/M.*README\.md/);      // Modified (index or worktree)
      expect(status).toContain('?? untracked.txt'); // Untracked
    } finally {
      repo.cleanup();
    }
  });

  it('should push to remote and track ahead count', () => {
    const { repo, remote } = createTestRepoWithRemote('push-test');

    try {
      // Create and commit a new file
      repo.createFile('new-feature.txt', 'Feature code');
      repo.commitAll('Add new feature');

      // Check ahead count
      const status = repo.git('status -sb');
      expect(status).toContain('ahead 1');

      // Push
      repo.git('push');

      // Check ahead count - should be 0
      const statusAfter = repo.git('status -sb');
      expect(statusAfter).not.toContain('ahead');
    } finally {
      repo.cleanup();
      remote.cleanup();
    }
  });

  it('should pull changes from remote', () => {
    const { repo, remote } = createTestRepoWithRemote('pull-test');

    try {
      // Create another clone and push changes
      const { execSync } = require('node:child_process');
      const { join } = require('node:path');
      const { tmpdir } = require('node:os');
      const otherClonePath = join(tmpdir(), `other-clone-${Date.now()}`);

      execSync(`git clone "${remote.path}" "${otherClonePath}"`, { stdio: 'pipe' });
      execSync('git config user.email "other@test.com"', { cwd: otherClonePath, stdio: 'pipe' });
      execSync('git config user.name "Other User"', { cwd: otherClonePath, stdio: 'pipe' });

      // Make changes in other clone
      const { writeFileSync } = require('node:fs');
      writeFileSync(join(otherClonePath, 'remote-change.txt'), 'From remote');
      execSync('git add -A', { cwd: otherClonePath, stdio: 'pipe' });
      execSync('git commit -m "Remote change"', { cwd: otherClonePath, stdio: 'pipe' });
      execSync('git push', { cwd: otherClonePath, stdio: 'pipe' });

      // Fetch in original repo
      repo.git('fetch');

      // Check behind count
      const status = repo.git('status -sb');
      expect(status).toContain('behind');

      // Pull
      repo.git('pull');

      // Verify file exists
      const files = repo.git('ls-files');
      expect(files).toContain('remote-change.txt');

      // Cleanup other clone
      const { rmSync } = require('node:fs');
      rmSync(otherClonePath, { recursive: true, force: true });
    } finally {
      repo.cleanup();
      remote.cleanup();
    }
  });
});
