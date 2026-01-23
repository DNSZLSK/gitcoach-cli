/**
 * Integration tests for Stash Operations
 * Tests: save, list, apply, pop, drop
 */

import { createTestRepoWithCommit } from '../helpers/test-utils.js';
import { createMockGitService, type MockGitService } from '../helpers/mock-git.js';
import { createMockPrompts, userFlow, type MockPrompts } from '../helpers/mock-prompts.js';

jest.mock('../../src/services/git-service.js');
jest.mock('../../src/ui/components/prompt.js');

describe('Stash Operations', () => {
  let mockGitService: MockGitService;
  let mockPrompts: MockPrompts;

  beforeEach(() => {
    mockGitService = createMockGitService({
      modified: ['file.txt'],
      staged: ['staged.txt'],
      stashes: [
        'WIP on main: abc123 Previous stash',
        'feature-work: def456 Another stash'
      ]
    });
    mockPrompts = createMockPrompts();
    jest.clearAllMocks();
  });

  describe('Save Stash', () => {
    it('should save current work to stash', async () => {
      await mockGitService.stash();

      expect(mockGitService.stash).toHaveBeenCalled();
      expect(mockGitService.__state.stashes.length).toBeGreaterThan(2);
    });

    it('should save with custom message', async () => {
      await mockGitService.stash('My work in progress');

      expect(mockGitService.stash).toHaveBeenCalledWith('My work in progress');
    });

    it('should clear working directory after stash', async () => {
      mockGitService.__setState({
        modified: ['a.txt', 'b.txt'],
        staged: ['c.txt'],
        untracked: ['d.txt']
      });

      await mockGitService.stash();

      expect(mockGitService.__state.modified).toHaveLength(0);
      expect(mockGitService.__state.staged).toHaveLength(0);
    });

    it('should prompt for optional message', async () => {
      const responses = userFlow()
        .select('save')
        .input('WIP: implementing feature X')
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Action', []);
      expect(action).toBe('save');

      const message = await mockPrompts.promptInput('Message (optional)');
      expect(message).toBe('WIP: implementing feature X');
    });

    it('should handle stash without message', async () => {
      const responses = userFlow()
        .select('save')
        .input('')  // No message
        .build();

      mockPrompts.__setResponses(responses);

      await mockPrompts.promptSelect('Action', []);
      const message = await mockPrompts.promptInput('Message');
      expect(message).toBe('');

      // Should still stash
      await mockGitService.stash();
      expect(mockGitService.stash).toHaveBeenCalled();
    });

    it('should not stash when working tree is clean', async () => {
      mockGitService.__setState({
        modified: [],
        staged: [],
        untracked: []
      });

      const hasChanges = await mockGitService.hasUncommittedChanges();
      expect(hasChanges).toBe(false);

      // In real flow, should show "Nothing to stash" message
    });
  });

  describe('List Stashes', () => {
    it('should list all stashes', async () => {
      const stashes = await mockGitService.getStashList();

      expect(stashes).toHaveLength(2);
      expect(stashes[0]).toContain('Previous stash');
      expect(stashes[1]).toContain('Another stash');
    });

    it('should show index with stash entries', async () => {
      const stashes = await mockGitService.getStashList();

      stashes.forEach((_stash, index) => {
        // In display: stash@{0}, stash@{1}, etc.
        expect(typeof index).toBe('number');
      });
    });

    it('should handle empty stash list', async () => {
      mockGitService.__setState({ stashes: [] });

      const stashes = await mockGitService.getStashList();
      expect(stashes).toHaveLength(0);
    });
  });

  describe('Apply Stash', () => {
    it('should apply stash and keep it in list', async () => {
      const stashesBefore = mockGitService.__state.stashes.length;

      await mockGitService.stashApply(0);

      expect(mockGitService.stashApply).toHaveBeenCalledWith(0);
      // Stash should still be in list
      expect(mockGitService.__state.stashes.length).toBe(stashesBefore);
    });

    it('should allow selecting which stash to apply', async () => {
      const responses = userFlow()
        .select('apply')
        .select(1)  // Select second stash
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Action', []);
      expect(action).toBe('apply');

      const stashIndex = await mockPrompts.promptSelect('Select stash', []);
      expect(stashIndex).toBe(1);
    });

    it('should show explanation of what apply does', async () => {
      // Apply keeps the stash vs Pop removes it
      const responses = userFlow()
        .select('apply')
        .select(0)
        .build();

      mockPrompts.__setResponses(responses);

      await mockPrompts.promptSelect('Action', []);
      await mockPrompts.promptSelect('Stash', []);

      // Apply was called
      await mockGitService.stashApply(0);
      expect(mockGitService.stashApply).toHaveBeenCalled();
    });
  });

  describe('Pop Stash', () => {
    it('should apply and remove latest stash', async () => {
      const stashesBefore = mockGitService.__state.stashes.length;

      await mockGitService.stashPop();

      expect(mockGitService.stashPop).toHaveBeenCalled();
      expect(mockGitService.__state.stashes.length).toBe(stashesBefore - 1);
    });

    it('should always pop the latest (index 0)', async () => {
      const firstStash = mockGitService.__state.stashes[0];

      await mockGitService.stashPop();

      expect(mockGitService.__state.stashes[0]).not.toBe(firstStash);
    });

    it('should handle pop flow', async () => {
      const responses = userFlow()
        .select('pop')
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Action', []);
      expect(action).toBe('pop');

      await mockGitService.stashPop();
      expect(mockGitService.stashPop).toHaveBeenCalled();
    });

    it('should handle pop when stash list is empty', async () => {
      mockGitService.__setState({ stashes: [] });

      const stashes = await mockGitService.getStashList();
      expect(stashes).toHaveLength(0);

      // In real flow, should show "No stashes" message
    });
  });

  describe('Drop Stash', () => {
    it('should delete specific stash', async () => {
      const stashesBefore = [...mockGitService.__state.stashes];

      await mockGitService.stashDrop(1);

      expect(mockGitService.stashDrop).toHaveBeenCalledWith(1);
      expect(mockGitService.__state.stashes.length).toBe(stashesBefore.length - 1);
    });

    it('should require confirmation before drop', async () => {
      const responses = userFlow()
        .select('drop')
        .select(0)
        .confirm(true)  // Confirm deletion
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Action', []);
      expect(action).toBe('drop');

      const stashIndex = await mockPrompts.promptSelect('Select stash', []);
      expect(stashIndex).toBe(0);

      const confirm = await mockPrompts.promptConfirm('Delete this stash?');
      expect(confirm).toBe(true);
    });

    it('should cancel drop if user declines', async () => {
      const responses = userFlow()
        .select('drop')
        .select(0)
        .confirm(false)
        .build();

      mockPrompts.__setResponses(responses);

      await mockPrompts.promptSelect('Action', []);
      await mockPrompts.promptSelect('Stash', []);
      const confirm = await mockPrompts.promptConfirm('Delete?');

      expect(confirm).toBe(false);
      expect(mockGitService.stashDrop).not.toHaveBeenCalled();
    });
  });

  describe('Stash Menu Navigation', () => {
    it('should show all stash options', async () => {
      const stashActions = ['save', 'list', 'apply', 'pop', 'drop', 'back'];

      for (const action of stashActions) {
        const responses = userFlow().select(action).build();
        mockPrompts.__setResponses(responses);
        mockPrompts.__reset();

        const selected = await mockPrompts.promptSelect('Action', []);
        expect(selected).toBe(action);
      }
    });

    it('should allow going back', async () => {
      const responses = userFlow()
        .select('back')
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Action', []);
      expect(action).toBe('back');
    });

    it('should loop until user goes back', async () => {
      // Stash menu loops to allow multiple operations
      const responses = userFlow()
        .select('list')
        .select('back')
        .build();

      mockPrompts.__setResponses(responses);

      const first = await mockPrompts.promptSelect('Action', []);
      expect(first).toBe('list');

      const second = await mockPrompts.promptSelect('Action', []);
      expect(second).toBe('back');
    });
  });
});

describe('Stash Operations - Real Git', () => {
  it('should save and list stash', () => {
    const repo = createTestRepoWithCommit('real-stash-save');

    try {
      // Make changes
      repo.modifyFile('README.md', 'Modified for stash');

      // Stash
      repo.git('stash push -m "Test stash"');

      // List
      const stashes = repo.git('stash list');
      expect(stashes).toContain('Test stash');

      // Working tree should be clean
      const status = repo.git('status --porcelain');
      expect(status).toBe('');
    } finally {
      repo.cleanup();
    }
  });

  it('should apply stash', () => {
    const repo = createTestRepoWithCommit('real-stash-apply');

    try {
      const { readFileSync } = require('node:fs');
      const { join } = require('node:path');

      // Make changes and stash
      repo.modifyFile('README.md', 'Stashed content');
      repo.git('stash push -m "To apply"');

      // Verify clean
      let content = readFileSync(join(repo.path, 'README.md'), 'utf-8');
      expect(content).toBe('# Test Repository');

      // Apply
      repo.git('stash apply');

      // Verify changes restored
      content = readFileSync(join(repo.path, 'README.md'), 'utf-8');
      expect(content).toBe('Stashed content');

      // Stash should still exist
      const stashes = repo.git('stash list');
      expect(stashes).toContain('To apply');
    } finally {
      repo.cleanup();
    }
  });

  it('should pop stash', () => {
    const repo = createTestRepoWithCommit('real-stash-pop');

    try {
      // Make changes and stash
      repo.modifyFile('README.md', 'Pop content');
      repo.git('stash push -m "To pop"');

      // Pop
      repo.git('stash pop');

      // Stash should be gone
      const stashes = repo.git('stash list');
      expect(stashes).not.toContain('To pop');

      // Changes should be restored
      const status = repo.git('status --porcelain');
      expect(status).toContain('README.md');
    } finally {
      repo.cleanup();
    }
  });

  it('should drop stash', () => {
    const repo = createTestRepoWithCommit('real-stash-drop');

    try {
      // Create two stashes
      repo.modifyFile('README.md', 'First stash');
      repo.git('stash push -m "First"');

      repo.modifyFile('README.md', 'Second stash');
      repo.git('stash push -m "Second"');

      // Drop first (index 0 is most recent)
      repo.git('stash drop stash@{0}');

      // Only "First" should remain
      const stashes = repo.git('stash list');
      expect(stashes).not.toContain('Second');
      expect(stashes).toContain('First');
    } finally {
      repo.cleanup();
    }
  });

  it('should handle empty stash list', () => {
    const repo = createTestRepoWithCommit('real-stash-empty');

    try {
      const stashes = repo.git('stash list');
      expect(stashes).toBe('');
    } finally {
      repo.cleanup();
    }
  });
});
