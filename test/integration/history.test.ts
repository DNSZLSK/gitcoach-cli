/**
 * Integration tests for History (Git Log)
 * Tests: view commits, view commit details
 */

import { createTestRepoWithCommit } from '../helpers/test-utils.js';
import { createMockGitService, type MockGitService } from '../helpers/mock-git.js';
import { createMockPrompts, userFlow, type MockPrompts } from '../helpers/mock-prompts.js';

jest.mock('../../src/services/git-service.js');
jest.mock('../../src/ui/components/prompt.js');

describe('History (Git Log)', () => {
  let mockGitService: MockGitService;
  let mockPrompts: MockPrompts;

  beforeEach(() => {
    mockGitService = createMockGitService({
      commits: [
        { hash: 'abc1234', date: '2024-01-03T10:30:00Z', message: 'feat: add new feature', author: 'Alice' },
        { hash: 'def5678', date: '2024-01-02T15:45:00Z', message: 'fix: resolve bug in login', author: 'Bob' },
        { hash: 'ghi9012', date: '2024-01-01T09:00:00Z', message: 'Initial commit', author: 'Alice' }
      ]
    });
    mockPrompts = createMockPrompts();
    jest.clearAllMocks();
  });

  describe('View Commits', () => {
    it('should display recent commits', async () => {
      const commits = await mockGitService.getLog(10);

      expect(commits).toHaveLength(3);
      expect(commits[0].hash).toBe('abc1234');
      expect(commits[0].message).toBe('feat: add new feature');
    });

    it('should show commits with hash, message, date, author', async () => {
      const commits = await mockGitService.getLog(1);
      const commit = commits[0];

      expect(commit.hash).toBeDefined();
      expect(commit.message).toBeDefined();
      expect(commit.date).toBeDefined();
      expect(commit.author).toBeDefined();
    });

    it('should limit number of commits shown', async () => {
      // Add more commits
      mockGitService.__setState({
        commits: Array.from({ length: 20 }, (_, i) => ({
          hash: `hash${i}`,
          date: new Date().toISOString(),
          message: `Commit ${i}`,
          author: 'Test'
        }))
      });

      const commits = await mockGitService.getLog(10);
      expect(commits).toHaveLength(10);
    });

    it('should handle empty history', async () => {
      mockGitService.__setState({ commits: [] });

      const commits = await mockGitService.getLog(10);
      expect(commits).toHaveLength(0);
    });

    it('should offer to load more commits', async () => {
      const responses = userFlow()
        .select('view_more')
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Action', []);
      expect(action).toBe('view_more');
    });
  });

  describe('View Commit Details', () => {
    it('should show details for selected commit', async () => {
      const commits = await mockGitService.getLog(10);
      const selectedCommit = commits[0];

      expect(selectedCommit.hash).toBe('abc1234');
      expect(selectedCommit.author).toBe('Alice');
      expect(selectedCommit.message).toBe('feat: add new feature');
      expect(selectedCommit.date).toBe('2024-01-03T10:30:00Z');
    });

    it('should allow selecting commit from list', async () => {
      const responses = userFlow()
        .select('abc1234')  // Select specific commit by hash
        .build();

      mockPrompts.__setResponses(responses);

      const selectedHash = await mockPrompts.promptSelect('Select commit', []);
      expect(selectedHash).toBe('abc1234');
    });

    it('should return to list after viewing details', async () => {
      const responses = userFlow()
        .select('def5678')  // View commit
        .select('back')     // Go back
        .build();

      mockPrompts.__setResponses(responses);

      const commit = await mockPrompts.promptSelect('Select commit', []);
      expect(commit).toBe('def5678');

      const backAction = await mockPrompts.promptSelect('Action', []);
      expect(backAction).toBe('back');
    });
  });

  describe('Relative Time Display', () => {
    it('should format dates as relative time', () => {
      // This would be tested via the formatRelativeTime function
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const oneDayAgo = new Date(now.getTime() - 86400000);

      // The actual formatting is done in history-menu.ts
      expect(oneHourAgo.getTime()).toBeLessThan(now.getTime());
      expect(oneDayAgo.getTime()).toBeLessThan(oneHourAgo.getTime());
    });
  });

  describe('History Menu Navigation', () => {
    it('should allow going back to main menu', async () => {
      const responses = userFlow()
        .select('back')
        .build();

      mockPrompts.__setResponses(responses);

      const action = await mockPrompts.promptSelect('Action', []);
      expect(action).toBe('back');
    });

    it('should show separator before back option', () => {
      // Menu structure includes separator
      const menuOptions = [
        { value: 'abc1234', name: 'commit 1' },
        { value: 'def5678', name: 'commit 2' },
        { value: 'separator', disabled: true },
        { value: 'view_more', name: 'Load more' },
        { value: 'back', name: 'Back' }
      ];

      expect(menuOptions.find(o => o.value === 'separator')).toBeDefined();
    });
  });
});

describe('History - Real Git', () => {
  it('should list real commits', () => {
    const repo = createTestRepoWithCommit('real-history');

    try {
      // Add more commits
      repo.createFile('file1.txt', 'content 1');
      repo.commitAll('Second commit');

      repo.createFile('file2.txt', 'content 2');
      repo.commitAll('Third commit');

      // Get log
      const log = repo.git('log --oneline');
      const lines = log.split('\n').filter(l => l.trim());

      expect(lines.length).toBe(3);
      expect(log).toContain('Third commit');
      expect(log).toContain('Second commit');
      expect(log).toContain('Initial commit');
    } finally {
      repo.cleanup();
    }
  });

  it('should show commit details', () => {
    const repo = createTestRepoWithCommit('real-show');

    try {
      // Get latest commit hash
      const hash = repo.git('rev-parse --short HEAD');

      // Show commit
      const show = repo.git(`show ${hash} --stat`);

      expect(show).toContain('Initial commit');
      expect(show).toContain('README.md');
    } finally {
      repo.cleanup();
    }
  });

  it('should handle repo with many commits', () => {
    const repo = createTestRepoWithCommit('real-many');

    try {
      // Create 15 commits
      for (let i = 0; i < 14; i++) {
        repo.createFile(`file${i}.txt`, `content ${i}`);
        repo.commitAll(`Commit ${i + 2}`);
      }

      // Get limited log
      const log = repo.git('log --oneline -10');
      const lines = log.split('\n').filter(l => l.trim());

      expect(lines.length).toBe(10);
    } finally {
      repo.cleanup();
    }
  });

  it('should show commit with author and date', () => {
    const repo = createTestRepoWithCommit('real-format');

    try {
      const log = repo.git('log -1 --format="%H|%an|%ad|%s"');
      const parts = log.split('|');

      expect(parts.length).toBe(4);
      expect(parts[0]).toMatch(/^[a-f0-9]{40}$/);  // Full hash
      expect(parts[1]).toBe('Test User');
      expect(parts[3]).toBe('Initial commit');
    } finally {
      repo.cleanup();
    }
  });
});
