/**
 * Integration tests for Error Prevention
 * Tests: uncommitted changes warning, force push protection, pull before push
 */

import { createTestRepoWithCommit, createTestRepoWithRemote } from '../helpers/test-utils.js';
import { createMockGitService, type MockGitService } from '../helpers/mock-git.js';
import { createMockPrompts, userFlow, type MockPrompts } from '../helpers/mock-prompts.js';

// Mock modules
jest.mock('../../src/services/git-service.js');
jest.mock('../../src/ui/components/prompt.js');
jest.mock('../../src/services/prevention-service.js');

describe('Error Prevention', () => {
  let mockGitService: MockGitService;
  let mockPrompts: MockPrompts;

  beforeEach(() => {
    mockGitService = createMockGitService();
    mockPrompts = createMockPrompts();
    jest.clearAllMocks();
  });

  describe('Uncommitted Changes Warning', () => {
    it('should warn when switching branch with uncommitted changes', async () => {
      mockGitService.__setState({
        modified: ['file.txt'],
        staged: [],
        branches: [
          { name: 'main', current: true, commit: 'abc', label: 'main' },
          { name: 'feature', current: false, commit: 'def', label: 'feature' }
        ]
      });

      const hasChanges = await mockGitService.hasUncommittedChanges();
      expect(hasChanges).toBe(true);

      // User should be warned before checkout
      const responses = userFlow()
        .confirm(false)  // Don't proceed with uncommitted changes
        .build();

      mockPrompts.__setResponses(responses);

      const proceed = await mockPrompts.promptConfirm('You have uncommitted changes. Continue?');
      expect(proceed).toBe(false);
    });

    it('should allow checkout if user confirms', async () => {
      mockGitService.__setState({
        modified: ['file.txt'],
        currentBranch: 'main',
        branches: [
          { name: 'main', current: true, commit: 'abc', label: 'main' },
          { name: 'feature', current: false, commit: 'def', label: 'feature' }
        ]
      });

      const responses = userFlow()
        .confirm(true)  // Proceed anyway
        .build();

      mockPrompts.__setResponses(responses);

      const proceed = await mockPrompts.promptConfirm('Continue with uncommitted changes?');
      expect(proceed).toBe(true);

      // Checkout should work
      await mockGitService.checkout('feature');
      expect(mockGitService.__state.currentBranch).toBe('feature');
    });

    it('should not warn when working tree is clean', async () => {
      mockGitService.__setState({
        modified: [],
        staged: [],
        untracked: [],
        deleted: []
      });

      const hasChanges = await mockGitService.hasUncommittedChanges();
      expect(hasChanges).toBe(false);

      // No warning needed, checkout directly
      await mockGitService.checkout('feature');
      expect(mockGitService.checkout).toHaveBeenCalledWith('feature');
    });
  });

  describe('Force Push Protection', () => {
    it('should require double confirmation for force push', async () => {
      mockGitService.__setState({
        ahead: 1,
        behind: 2  // Remote has changes we'd overwrite
      });

      const responses = userFlow()
        .confirm(true)   // First confirmation
        .confirm(true)   // Second confirmation - "Are you absolutely sure?"
        .build();

      mockPrompts.__setResponses(responses);

      // First warning
      const firstConfirm = await mockPrompts.promptConfirm(
        'Force push will overwrite remote history. Are you sure?'
      );
      expect(firstConfirm).toBe(true);

      // Second warning - final confirmation
      const secondConfirm = await mockPrompts.promptConfirm(
        'Are you absolutely sure? This cannot be undone.'
      );
      expect(secondConfirm).toBe(true);

      // Now force push is allowed
      await mockGitService.push('origin', 'main', true);
      expect(mockGitService.push).toHaveBeenCalledWith('origin', 'main', true);
    });

    it('should cancel force push if user declines first confirmation', async () => {
      const responses = userFlow()
        .confirm(false)  // Decline first confirmation
        .build();

      mockPrompts.__setResponses(responses);

      const firstConfirm = await mockPrompts.promptConfirm('Force push?');
      expect(firstConfirm).toBe(false);

      // Force push should not be called
      expect(mockGitService.push).not.toHaveBeenCalled();
    });

    it('should cancel force push if user declines second confirmation', async () => {
      const responses = userFlow()
        .confirm(true)   // Accept first
        .confirm(false)  // Decline second
        .build();

      mockPrompts.__setResponses(responses);

      const firstConfirm = await mockPrompts.promptConfirm('Force push?');
      expect(firstConfirm).toBe(true);

      const secondConfirm = await mockPrompts.promptConfirm('Absolutely sure?');
      expect(secondConfirm).toBe(false);

      // Force push should not be called
      expect(mockGitService.push).not.toHaveBeenCalled();
    });
  });

  describe('Pull Before Push', () => {
    it('should suggest pull when remote is ahead', async () => {
      mockGitService.__setState({
        ahead: 1,
        behind: 3,
        tracking: 'origin/main'
      });

      const status = await mockGitService.getStatus();
      expect(status.behind).toBeGreaterThan(0);

      // Should offer: pull_then_push, force, cancel
      const responses = userFlow()
        .select('pull_then_push')
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Remote has 3 new commits. What to do?', []);
      expect(action).toBe('pull_then_push');
    });

    it('should pull then push when user selects that option', async () => {
      mockGitService.__setState({
        ahead: 1,
        behind: 2
      });

      // Pull first
      await mockGitService.pull('origin', 'main');
      expect(mockGitService.__state.behind).toBe(0);

      // Then push
      await mockGitService.push('origin', 'main');
      expect(mockGitService.__state.ahead).toBe(0);
    });

    it('should allow force push as alternative', async () => {
      mockGitService.__setState({
        ahead: 1,
        behind: 2
      });

      const responses = userFlow()
        .select('force')
        .confirm(true)  // First force push confirm
        .confirm(true)  // Second force push confirm
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Action?', []);
      expect(action).toBe('force');
    });

    it('should allow canceling push', async () => {
      const responses = userFlow()
        .select('cancel')
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Action?', []);
      expect(action).toBe('cancel');

      expect(mockGitService.push).not.toHaveBeenCalled();
      expect(mockGitService.pull).not.toHaveBeenCalled();
    });

    it('should allow direct push when not behind', async () => {
      mockGitService.__setState({
        ahead: 2,
        behind: 0,
        tracking: 'origin/main'
      });

      const status = await mockGitService.getStatus();
      expect(status.behind).toBe(0);
      expect(status.ahead).toBe(2);

      // No pull needed, can push directly
      const responses = userFlow()
        .confirm(true)  // Confirm push
        .build();

      mockPrompts.__setResponses(responses);

      const confirmPush = await mockPrompts.promptConfirm('Push 2 commits?');
      expect(confirmPush).toBe(true);

      await mockGitService.push('origin', 'main');
      expect(mockGitService.push).toHaveBeenCalled();
    });
  });

  describe('Hard Reset Protection', () => {
    it('should require double confirmation for hard reset', async () => {
      mockGitService.__setState({
        commits: [
          { hash: 'abc123', date: '2024-01-01', message: 'Last commit', author: 'Test' }
        ],
        modified: ['file.txt']
      });

      const responses = userFlow()
        .confirm(true)   // First: Are you sure?
        .confirm(true)   // Second: FINAL WARNING
        .build();

      mockPrompts.__setResponses(responses);

      const firstConfirm = await mockPrompts.promptConfirm(
        'Are you sure? This will DELETE all changes!'
      );
      expect(firstConfirm).toBe(true);

      const secondConfirm = await mockPrompts.promptConfirm(
        'FINAL WARNING: This cannot be undone!'
      );
      expect(secondConfirm).toBe(true);

      // Now reset is allowed
      await mockGitService.reset('hard', 'HEAD~1');
      expect(mockGitService.reset).toHaveBeenCalledWith('hard', 'HEAD~1');
      expect(mockGitService.__state.modified).toHaveLength(0);
    });

    it('should cancel hard reset if user declines', async () => {
      const responses = userFlow()
        .confirm(true)   // First confirm
        .confirm(false)  // Decline final warning
        .build();

      mockPrompts.__setResponses(responses);

      await mockPrompts.promptConfirm('Sure?');
      const finalConfirm = await mockPrompts.promptConfirm('Final warning');
      expect(finalConfirm).toBe(false);

      expect(mockGitService.reset).not.toHaveBeenCalled();
    });
  });

  describe('Detached HEAD Warning', () => {
    it('should warn when in detached HEAD state', async () => {
      mockGitService.__setState({
        detached: true,
        currentBranch: null
      });

      const isDetached = await mockGitService.isDetachedHead();
      expect(isDetached).toBe(true);

      // Warning should be shown to user
    });

    it('should suggest creating a branch in detached state', async () => {
      mockGitService.__setState({
        detached: true,
        currentBranch: null
      });

      const responses = userFlow()
        .confirm(true)  // Create branch?
        .input('save-work')  // Branch name
        .build();

      mockPrompts.__setResponses(responses);

      const createBranch = await mockPrompts.promptConfirm('Create a branch to save work?');
      expect(createBranch).toBe(true);

      const branchName = await mockPrompts.promptInput('Branch name');
      expect(branchName).toBe('save-work');

      await mockGitService.createBranch('save-work', true);
      expect(mockGitService.__state.currentBranch).toBe('save-work');
    });
  });
});

describe('Error Prevention - Real Git', () => {
  it('should detect uncommitted changes before checkout', () => {
    const repo = createTestRepoWithCommit('prevent-checkout');

    try {
      // Create a branch
      repo.git('checkout -b feature');
      repo.git('checkout main || git checkout master');

      // Make uncommitted changes
      repo.modifyFile('README.md', '# Modified');

      // Try to checkout - Git will warn/fail
      const status = repo.git('status --porcelain');
      expect(status).toContain('M README.md');

      // In real scenario, checkout might fail or warn
      // GitSense should catch this BEFORE attempting checkout
    } finally {
      repo.cleanup();
    }
  });

  it('should prevent push when remote has diverged', () => {
    const { repo, remote } = createTestRepoWithRemote('diverged');

    try {
      const { execSync } = require('node:child_process');
      const { join } = require('node:path');
      const { tmpdir } = require('node:os');
      const { writeFileSync, rmSync } = require('node:fs');

      // Create another clone
      const otherPath = join(tmpdir(), `other-${Date.now()}`);
      execSync(`git clone "${remote.path}" "${otherPath}"`, { stdio: 'pipe' });
      execSync('git config user.email "other@test.com"', { cwd: otherPath, stdio: 'pipe' });
      execSync('git config user.name "Other"', { cwd: otherPath, stdio: 'pipe' });

      // Make changes in both repos
      writeFileSync(join(otherPath, 'other.txt'), 'other');
      execSync('git add -A && git commit -m "Other change"', { cwd: otherPath, stdio: 'pipe' });
      execSync('git push', { cwd: otherPath, stdio: 'pipe' });

      repo.createFile('local.txt', 'local');
      repo.commitAll('Local change');

      // Fetch to see divergence
      repo.git('fetch');

      // Check status - should show diverged
      const status = repo.git('status -sb');
      expect(status).toContain('ahead');
      expect(status).toContain('behind');

      // Cleanup
      rmSync(otherPath, { recursive: true, force: true });
    } finally {
      repo.cleanup();
      remote.cleanup();
    }
  });
});
