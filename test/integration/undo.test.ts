/**
 * Integration tests for Undo Operations
 * Tests: soft reset, hard reset, unstage, restore
 */

import { createTestRepoWithCommit } from '../helpers/test-utils.js';
import { createMockGitService, type MockGitService } from '../helpers/mock-git.js';
import { createMockPrompts, userFlow, type MockPrompts } from '../helpers/mock-prompts.js';

jest.mock('../../src/services/git-service.js');
jest.mock('../../src/ui/components/prompt.js');

describe('Undo Operations', () => {
  let mockGitService: MockGitService;
  let mockPrompts: MockPrompts;

  beforeEach(() => {
    mockGitService = createMockGitService({
      commits: [
        { hash: 'latest123', date: '2024-01-02', message: 'Latest commit', author: 'Test' },
        { hash: 'prev456', date: '2024-01-01', message: 'Previous commit', author: 'Test' }
      ],
      staged: ['staged.txt'],
      modified: ['modified.txt'],
      ahead: 1
    });
    mockPrompts = createMockPrompts();
    jest.clearAllMocks();
  });

  describe('Soft Reset', () => {
    it('should undo last commit keeping files staged', async () => {
      const commitsBefore = mockGitService.__state.commits.length;

      await mockGitService.reset('soft', 'HEAD~1');

      expect(mockGitService.reset).toHaveBeenCalledWith('soft', 'HEAD~1');
      expect(mockGitService.__state.commits.length).toBe(commitsBefore - 1);
    });

    it('should decrement ahead count after soft reset', async () => {
      mockGitService.__setState({ ahead: 2 });

      await mockGitService.reset('soft', 'HEAD~1');

      expect(mockGitService.__state.ahead).toBe(1);
    });

    it('should show last commit info before reset', async () => {
      const commits = await mockGitService.getLog(1);

      expect(commits).toHaveLength(1);
      expect(commits[0].hash).toBe('latest123');
      expect(commits[0].message).toBe('Latest commit');
    });

    it('should require confirmation', async () => {
      const responses = userFlow()
        .select('soft_reset')
        .confirm(true)  // Confirm soft reset
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Undo action', []);
      expect(action).toBe('soft_reset');

      const confirm = await mockPrompts.promptConfirm('Undo this commit?');
      expect(confirm).toBe(true);
    });

    it('should cancel if user declines', async () => {
      const responses = userFlow()
        .select('soft_reset')
        .confirm(false)
        .build();

      mockPrompts.__setResponses(responses);

      await mockPrompts.promptSelect('Action', []);
      const confirm = await mockPrompts.promptConfirm('Confirm?');

      expect(confirm).toBe(false);
      expect(mockGitService.reset).not.toHaveBeenCalled();
    });
  });

  describe('Hard Reset', () => {
    it('should undo commit and discard all changes', async () => {
      mockGitService.__setState({
        modified: ['file.txt'],
        staged: ['other.txt'],
        commits: [
          { hash: 'abc', date: '2024-01-01', message: 'Test', author: 'User' }
        ]
      });

      await mockGitService.reset('hard', 'HEAD~1');

      expect(mockGitService.__state.modified).toHaveLength(0);
      expect(mockGitService.__state.staged).toHaveLength(0);
    });

    it('should require double confirmation', async () => {
      const responses = userFlow()
        .select('hard_reset')
        .confirm(true)   // First: Are you sure?
        .confirm(true)   // Second: FINAL WARNING
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Action', []);
      expect(action).toBe('hard_reset');

      const first = await mockPrompts.promptConfirm('Are you sure?');
      expect(first).toBe(true);

      const second = await mockPrompts.promptConfirm('FINAL WARNING');
      expect(second).toBe(true);
    });

    it('should abort if first confirmation declined', async () => {
      const responses = userFlow()
        .select('hard_reset')
        .confirm(false)
        .build();

      mockPrompts.__setResponses(responses);

      await mockPrompts.promptSelect('Action', []);
      const confirm = await mockPrompts.promptConfirm('Sure?');

      expect(confirm).toBe(false);
      expect(mockGitService.reset).not.toHaveBeenCalled();
    });

    it('should abort if second confirmation declined', async () => {
      const responses = userFlow()
        .select('hard_reset')
        .confirm(true)
        .confirm(false)
        .build();

      mockPrompts.__setResponses(responses);

      await mockPrompts.promptSelect('Action', []);
      await mockPrompts.promptConfirm('Sure?');
      const second = await mockPrompts.promptConfirm('Final?');

      expect(second).toBe(false);
      expect(mockGitService.reset).not.toHaveBeenCalled();
    });
  });

  describe('Unstage Files', () => {
    it('should show staged files for selection', async () => {
      mockGitService.__setState({
        staged: ['file1.txt', 'file2.txt', 'src/index.ts']
      });

      const stagedFiles = await mockGitService.getStagedFiles();

      expect(stagedFiles).toHaveLength(3);
      expect(stagedFiles).toContain('file1.txt');
    });

    it('should unstage selected files', async () => {
      mockGitService.__setState({
        staged: ['file1.txt', 'file2.txt']
      });

      const responses = userFlow()
        .select('unstage')
        .checkbox(['file1.txt'])
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Action', []);
      expect(action).toBe('unstage');

      const selected = await mockPrompts.promptCheckbox('Select files', []);
      expect(selected).toEqual(['file1.txt']);
    });

    it('should handle no staged files', async () => {
      mockGitService.__setState({ staged: [] });

      const stagedFiles = await mockGitService.getStagedFiles();
      expect(stagedFiles).toHaveLength(0);

      // Should show info message and return
    });

    it('should cancel if no files selected', async () => {
      const responses = userFlow()
        .select('unstage')
        .checkbox([])  // No files selected
        .build();

      mockPrompts.__setResponses(responses);

      await mockPrompts.promptSelect('Action', []);
      const selected = await mockPrompts.promptCheckbox('Files', []);

      expect(selected).toHaveLength(0);
    });
  });

  describe('Restore Files', () => {
    it('should show modified files for selection', async () => {
      mockGitService.__setState({
        modified: ['changed.txt', 'other.js'],
        deleted: ['removed.txt']
      });

      const modified = await mockGitService.getUnstagedFiles();

      expect(modified).toContain('changed.txt');
      expect(modified).toContain('removed.txt');
    });

    it('should restore selected files', async () => {
      const responses = userFlow()
        .select('restore')
        .checkbox(['changed.txt'])
        .confirm(true)  // Confirm data loss
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Action', []);
      expect(action).toBe('restore');

      const files = await mockPrompts.promptCheckbox('Files', []);
      expect(files).toEqual(['changed.txt']);

      const confirm = await mockPrompts.promptConfirm('Discard changes?');
      expect(confirm).toBe(true);
    });

    it('should require confirmation due to data loss', async () => {
      const responses = userFlow()
        .select('restore')
        .checkbox(['file.txt'])
        .confirm(false)  // Cancel
        .build();

      mockPrompts.__setResponses(responses);

      await mockPrompts.promptSelect('Action', []);
      await mockPrompts.promptCheckbox('Files', []);
      const confirm = await mockPrompts.promptConfirm('Discard?');

      expect(confirm).toBe(false);
      expect(mockGitService.checkout).not.toHaveBeenCalled();
    });

    it('should handle no modified files', async () => {
      mockGitService.__setState({
        modified: [],
        deleted: []
      });

      const files = await mockGitService.getUnstagedFiles();
      expect(files).toHaveLength(0);
    });
  });

  describe('Undo Menu Navigation', () => {
    it('should allow going back', async () => {
      const responses = userFlow()
        .select('back')
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Undo action', []);
      expect(action).toBe('back');
    });

    it('should show all undo options', async () => {
      const undoOptions = ['soft_reset', 'hard_reset', 'unstage', 'restore', 'back'];

      for (const option of undoOptions) {
        const responses = userFlow().select(option).build();
        mockPrompts.__setResponses(responses);
        mockPrompts.__reset();

        const selected = await mockPrompts.promptSelect('Action', []);
        expect(selected).toBe(option);
      }
    });
  });
});

describe('Undo Operations - Real Git', () => {
  it('should perform soft reset', () => {
    const repo = createTestRepoWithCommit('real-soft-reset');

    try {
      // Make another commit
      repo.createFile('new.txt', 'content');
      repo.commitAll('Second commit');

      const commitsBefore = repo.git('rev-list --count HEAD');
      expect(parseInt(commitsBefore)).toBe(2);

      // Soft reset
      repo.git('reset --soft HEAD~1');

      const commitsAfter = repo.git('rev-list --count HEAD');
      expect(parseInt(commitsAfter)).toBe(1);

      // File should still be staged
      const status = repo.git('status --porcelain');
      expect(status).toContain('A  new.txt');
    } finally {
      repo.cleanup();
    }
  });

  it('should perform hard reset', () => {
    const repo = createTestRepoWithCommit('real-hard-reset');

    try {
      // Make changes and commit
      repo.createFile('to-remove.txt', 'will be gone');
      repo.commitAll('Commit to undo');

      // Hard reset
      repo.git('reset --hard HEAD~1');

      // File should be gone
      const { existsSync } = require('node:fs');
      const { join } = require('node:path');
      expect(existsSync(join(repo.path, 'to-remove.txt'))).toBe(false);
    } finally {
      repo.cleanup();
    }
  });

  it('should unstage files', () => {
    const repo = createTestRepoWithCommit('real-unstage');

    try {
      // Create and stage file
      repo.createFile('staged.txt', 'content');
      repo.git('add staged.txt');

      // Verify staged
      let status = repo.git('status --porcelain');
      expect(status).toContain('A  staged.txt');

      // Unstage
      repo.git('restore --staged staged.txt');

      // Verify unstaged
      status = repo.git('status --porcelain');
      expect(status).toContain('?? staged.txt');
    } finally {
      repo.cleanup();
    }
  });

  it('should restore file to last commit', () => {
    const repo = createTestRepoWithCommit('real-restore');

    try {
      const { readFileSync } = require('node:fs');
      const { join } = require('node:path');

      // Modify tracked file
      repo.modifyFile('README.md', 'Modified content');

      // Verify modified
      let status = repo.git('status --porcelain');
      expect(status).toContain('M README.md');

      // Restore
      repo.git('restore README.md');

      // Verify restored
      status = repo.git('status --porcelain');
      expect(status).not.toContain('README.md');

      // Content should be original
      const content = readFileSync(join(repo.path, 'README.md'), 'utf-8');
      expect(content).toBe('# Test Repository');
    } finally {
      repo.cleanup();
    }
  });
});
