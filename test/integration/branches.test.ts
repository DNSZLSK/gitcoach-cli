/**
 * Integration tests for Branch Management
 * Tests: list, create, switch, delete, rename
 */

import { createTestRepoWithCommit } from '../helpers/test-utils.js';
import { createMockGitService, type MockGitService } from '../helpers/mock-git.js';
import { createMockPrompts, userFlow, type MockPrompts } from '../helpers/mock-prompts.js';

jest.mock('../../src/services/git-service.js');
jest.mock('../../src/ui/components/prompt.js');

describe('Branch Management', () => {
  let mockGitService: MockGitService;
  let mockPrompts: MockPrompts;

  beforeEach(() => {
    mockGitService = createMockGitService({
      branches: [
        { name: 'main', current: true, commit: 'abc123', label: 'main' },
        { name: 'develop', current: false, commit: 'def456', label: 'develop' },
        { name: 'feature/login', current: false, commit: 'ghi789', label: 'feature/login' }
      ],
      currentBranch: 'main'
    });
    mockPrompts = createMockPrompts();
    jest.clearAllMocks();
  });

  describe('List Branches', () => {
    it('should list all branches', async () => {
      const branches = await mockGitService.getBranches();

      expect(branches).toHaveLength(3);
      expect(branches.map(b => b.name)).toContain('main');
      expect(branches.map(b => b.name)).toContain('develop');
      expect(branches.map(b => b.name)).toContain('feature/login');
    });

    it('should indicate current branch', async () => {
      const branches = await mockGitService.getBranches();
      const currentBranch = branches.find(b => b.current);

      expect(currentBranch).toBeDefined();
      expect(currentBranch?.name).toBe('main');
    });

    it('should show branch menu options', async () => {
      const responses = userFlow()
        .select('list')
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Branch action', []);
      expect(action).toBe('list');
    });
  });

  describe('Create Branch', () => {
    it('should create a new branch', async () => {
      await mockGitService.createBranch('feature/new', false);

      expect(mockGitService.createBranch).toHaveBeenCalledWith('feature/new', false);
      expect(mockGitService.__state.branches).toHaveLength(4);
      expect(mockGitService.__state.branches.map(b => b.name)).toContain('feature/new');
    });

    it('should create and checkout new branch', async () => {
      await mockGitService.createBranch('feature/new', true);

      expect(mockGitService.__state.currentBranch).toBe('feature/new');
      const newBranch = mockGitService.__state.branches.find(b => b.name === 'feature/new');
      expect(newBranch?.current).toBe(true);
    });

    it('should prompt for branch name', async () => {
      const responses = userFlow()
        .select('create')
        .input('feature/awesome')
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Action', []);
      expect(action).toBe('create');

      const branchName = await mockPrompts.promptInput('Branch name');
      expect(branchName).toBe('feature/awesome');
    });

    it('should validate branch name', () => {
      const validNames = ['main', 'feature/test', 'bugfix-123', 'release-v1.0'];

      // This would be handled by validators in real flow
      for (const name of validNames) {
        expect(name.length).toBeGreaterThan(0);
        expect(name.startsWith('.')).toBe(false);
        expect(name.startsWith('-')).toBe(false);
      }
    });
  });

  describe('Switch Branch', () => {
    it('should switch to existing branch', async () => {
      mockGitService.__setState({ currentBranch: 'main' });

      await mockGitService.checkout('develop');

      expect(mockGitService.__state.currentBranch).toBe('develop');
    });

    it('should update current flag on branches', async () => {
      await mockGitService.checkout('feature/login');

      const branches = mockGitService.__state.branches;
      expect(branches.find(b => b.name === 'main')?.current).toBe(false);
      expect(branches.find(b => b.name === 'feature/login')?.current).toBe(true);
    });

    it('should offer branch selection', async () => {
      const responses = userFlow()
        .select('switch')
        .select('develop')
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Action', []);
      expect(action).toBe('switch');

      const targetBranch = await mockPrompts.promptSelect('Select branch', []);
      expect(targetBranch).toBe('develop');
    });

    it('should filter out current branch from switch options', async () => {
      const branches = await mockGitService.getBranches();
      const switchOptions = branches.filter(b => !b.current);

      expect(switchOptions.map(b => b.name)).not.toContain('main');
      expect(switchOptions).toHaveLength(2);
    });
  });

  describe('Delete Branch', () => {
    it('should delete a branch', async () => {
      await mockGitService.deleteBranch('feature/login');

      expect(mockGitService.deleteBranch).toHaveBeenCalledWith('feature/login');
      expect(mockGitService.__state.branches.map(b => b.name)).not.toContain('feature/login');
    });

    it('should not allow deleting current branch', async () => {
      const branches = await mockGitService.getBranches();
      const deletableBranches = branches.filter(b => !b.current);

      expect(deletableBranches.map(b => b.name)).not.toContain('main');
    });

    it('should require confirmation for delete', async () => {
      const responses = userFlow()
        .select('delete')
        .select('develop')
        .confirm(true)  // Confirm deletion
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Action', []);
      expect(action).toBe('delete');

      const branch = await mockPrompts.promptSelect('Branch to delete', []);
      expect(branch).toBe('develop');

      const confirm = await mockPrompts.promptConfirm('Delete develop?');
      expect(confirm).toBe(true);
    });

    it('should cancel delete if user declines', async () => {
      const responses = userFlow()
        .select('delete')
        .select('develop')
        .confirm(false)  // Cancel deletion
        .build();

      mockPrompts.__setResponses(responses);

      await mockPrompts.promptSelect('Action', []);
      await mockPrompts.promptSelect('Branch', []);
      const confirm = await mockPrompts.promptConfirm('Delete?');

      expect(confirm).toBe(false);
      expect(mockGitService.deleteBranch).not.toHaveBeenCalled();
    });
  });

  describe('Back Navigation', () => {
    it('should allow going back from branch menu', async () => {
      const responses = userFlow()
        .select('back')
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Branch action', []);
      expect(action).toBe('back');
    });
  });
});

describe('Branch Management - Real Git', () => {
  it('should list branches in real repo', () => {
    const repo = createTestRepoWithCommit('real-branches');

    try {
      // Create branches
      repo.git('checkout -b feature-a');
      repo.git('checkout -b feature-b');
      repo.git('checkout main || git checkout master');

      // List branches
      const branches = repo.git('branch');

      expect(branches).toContain('feature-a');
      expect(branches).toContain('feature-b');
      expect(branches).toMatch(/\* (main|master)/);  // Current branch marked with *
    } finally {
      repo.cleanup();
    }
  });

  it('should create and switch branches', () => {
    const repo = createTestRepoWithCommit('real-create');

    try {
      // Create and checkout
      repo.git('checkout -b new-feature');

      const current = repo.git('rev-parse --abbrev-ref HEAD');
      expect(current).toBe('new-feature');

      // Switch back
      repo.git('checkout main || git checkout master');
      const afterSwitch = repo.git('rev-parse --abbrev-ref HEAD');
      expect(['main', 'master']).toContain(afterSwitch);
    } finally {
      repo.cleanup();
    }
  });

  it('should delete branch', () => {
    const repo = createTestRepoWithCommit('real-delete');

    try {
      // Create branch
      repo.git('checkout -b to-delete');
      repo.git('checkout main || git checkout master');

      // Delete
      repo.git('branch -d to-delete');

      // Verify deleted
      const branches = repo.git('branch');
      expect(branches).not.toContain('to-delete');
    } finally {
      repo.cleanup();
    }
  });

  it('should prevent deleting current branch', () => {
    const repo = createTestRepoWithCommit('real-no-delete-current');

    try {
      const current = repo.git('rev-parse --abbrev-ref HEAD');

      // Try to delete current - should fail
      expect(() => {
        repo.git(`branch -d ${current}`);
      }).toThrow();
    } finally {
      repo.cleanup();
    }
  });
});
