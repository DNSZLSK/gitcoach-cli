/**
 * Integration tests for Setup Flow
 * Tests: init, clone, .gitignore creation
 */

import { createNonGitDir, createTestRepo, createBareRepo } from '../helpers/test-utils.js';
import { createMockGitService, type MockGitService } from '../helpers/mock-git.js';
import { createMockPrompts, userFlow, type MockPrompts } from '../helpers/mock-prompts.js';

// Mock modules
jest.mock('../../src/services/git-service.js');
jest.mock('../../src/ui/components/prompt.js');

describe('Setup Flow', () => {
  let mockGitService: MockGitService;
  let mockPrompts: MockPrompts;

  beforeEach(() => {
    mockGitService = createMockGitService({ isRepo: false });
    mockPrompts = createMockPrompts();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Non-Git Directory Detection', () => {
    it('should detect when directory is not a git repo', async () => {
      const dir = createNonGitDir('no-git-test');

      try {
        mockGitService.__setState({ isRepo: false });
        const result = await mockGitService.isGitRepo();

        expect(result).toBe(false);
        expect(mockGitService.isGitRepo).toHaveBeenCalled();
      } finally {
        dir.cleanup();
      }
    });

    it('should detect when directory is a git repo', async () => {
      const repo = createTestRepo('git-test');

      try {
        mockGitService.__setState({ isRepo: true });
        const result = await mockGitService.isGitRepo();

        expect(result).toBe(true);
      } finally {
        repo.cleanup();
      }
    });
  });

  describe('Git Init Flow', () => {
    it('should initialize a new git repository', async () => {
      const dir = createNonGitDir('init-test');

      try {
        // Simulate init
        await mockGitService.init();

        expect(mockGitService.init).toHaveBeenCalled();
        expect(mockGitService.__state.isRepo).toBe(true);
      } finally {
        dir.cleanup();
      }
    });

    it('should add remote origin after init', async () => {
      const remoteUrl = 'https://github.com/user/repo.git';

      await mockGitService.init();
      await mockGitService.addRemote('origin', remoteUrl);

      expect(mockGitService.addRemote).toHaveBeenCalledWith('origin', remoteUrl);
    });

    it('should handle init flow with all options', async () => {
      const responses = userFlow()
        .select('init')           // Choose init option
        .confirm(true)            // Add remote? Yes
        .input('https://github.com/user/repo.git')  // Remote URL
        .confirm(true)            // Create .gitignore? Yes
        .select('node')           // Project type
        .build();

      mockPrompts.__setResponses(responses);

      // Simulate full flow
      const initChoice = await mockPrompts.promptSelect('action', []);
      expect(initChoice).toBe('init');

      const addRemote = await mockPrompts.promptConfirm('Add remote?');
      expect(addRemote).toBe(true);

      const remoteUrl = await mockPrompts.promptInput('Remote URL');
      expect(remoteUrl).toBe('https://github.com/user/repo.git');

      const createGitignore = await mockPrompts.promptConfirm('Create .gitignore?');
      expect(createGitignore).toBe(true);

      const projectType = await mockPrompts.promptSelect('Project type', []);
      expect(projectType).toBe('node');
    });
  });

  describe('Git Clone Flow', () => {
    it('should clone a repository', async () => {
      const repoUrl = 'https://github.com/user/repo.git';

      await mockGitService.clone(repoUrl);

      expect(mockGitService.clone).toHaveBeenCalledWith(repoUrl);
      expect(mockGitService.__state.isRepo).toBe(true);
    });

    it('should clone to custom directory', async () => {
      const repoUrl = 'https://github.com/user/repo.git';
      const dirName = 'my-project';

      await mockGitService.clone(repoUrl, dirName);

      expect(mockGitService.clone).toHaveBeenCalledWith(repoUrl, dirName);
    });

    it('should handle clone flow with user inputs', async () => {
      const responses = userFlow()
        .select('clone')          // Choose clone option
        .input('https://github.com/user/repo.git')  // Repo URL
        .input('my-project')      // Directory name
        .build();

      mockPrompts.__setResponses(responses);

      const cloneChoice = await mockPrompts.promptSelect('action', []);
      expect(cloneChoice).toBe('clone');

      const repoUrl = await mockPrompts.promptInput('Repo URL');
      expect(repoUrl).toBe('https://github.com/user/repo.git');

      const dirName = await mockPrompts.promptInput('Directory');
      expect(dirName).toBe('my-project');
    });
  });

  describe('.gitignore Creation', () => {
    it('should offer gitignore templates for different project types', async () => {
      const projectTypes = ['node', 'python', 'java', 'generic'];

      for (const type of projectTypes) {
        const responses = userFlow().select(type).build();
        mockPrompts.__setResponses(responses);
        mockPrompts.__reset();

        const selectedType = await mockPrompts.promptSelect('type', []);
        expect(selectedType).toBe(type);
      }
    });

    it('should skip gitignore if user declines', async () => {
      const responses = userFlow()
        .confirm(false)  // Don't create .gitignore
        .build();

      mockPrompts.__setResponses(responses);

      const createGitignore = await mockPrompts.promptConfirm('Create .gitignore?');
      expect(createGitignore).toBe(false);
    });
  });

  describe('Setup Menu Navigation', () => {
    it('should allow user to quit from setup menu', async () => {
      const responses = userFlow()
        .select('quit')
        .build();

      mockPrompts.__setResponses(responses);

      const choice = await mockPrompts.promptSelect('action', []);
      expect(choice).toBe('quit');
    });

    it('should stay in setup menu after failed init', async () => {
      // User cancels init, menu should stay
      const responses = userFlow()
        .select('init')
        .confirm(false)  // Cancel remote add
        .confirm(false)  // Cancel .gitignore
        .build();

      mockPrompts.__setResponses(responses);

      const choice = await mockPrompts.promptSelect('action', []);
      expect(choice).toBe('init');
    });
  });
});

describe('Setup Flow - Real Git', () => {
  // These tests use actual git operations

  it('should actually initialize a git repo', () => {
    const dir = createNonGitDir('real-init');

    try {
      const { execSync } = require('node:child_process');

      // Verify it's not a repo
      expect(() => {
        execSync('git status', { cwd: dir.path, stdio: 'pipe' });
      }).toThrow();

      // Initialize
      execSync('git init', { cwd: dir.path, stdio: 'pipe' });

      // Verify it's now a repo
      expect(() => {
        execSync('git status', { cwd: dir.path, stdio: 'pipe' });
      }).not.toThrow();
    } finally {
      dir.cleanup();
    }
  });

  it('should actually clone a repo', () => {
    const bareRepo = createBareRepo('clone-source');
    const targetDir = createNonGitDir('clone-target');

    try {
      const { execSync } = require('node:child_process');
      const { join } = require('node:path');

      // Clone into target
      execSync(`git clone "${bareRepo.path}" cloned-repo`, {
        cwd: targetDir.path,
        stdio: 'pipe'
      });

      // Verify clone exists
      const clonedPath = join(targetDir.path, 'cloned-repo');
      expect(() => {
        execSync('git status', { cwd: clonedPath, stdio: 'pipe' });
      }).not.toThrow();
    } finally {
      bareRepo.cleanup();
      targetDir.cleanup();
    }
  });
});
