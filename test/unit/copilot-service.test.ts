import { copilotService } from '../../src/services/copilot-service.js';

// Mock i18n
jest.mock('../../src/i18n/index.js', () => ({
  t: (key: string) => key
}));

// Mock logger
jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    raw: jest.fn(),
    command: jest.fn(),
    success: jest.fn()
  }
}));

// Mock helpers
const mockExecuteCommand = jest.fn();
jest.mock('../../src/utils/helpers.js', () => ({
  executeCommand: (...args: unknown[]) => mockExecuteCommand(...args),
  sleep: jest.fn().mockResolvedValue(undefined)
}));

describe('CopilotService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    copilotService.resetAvailability();
  });

  describe('isAvailable', () => {
    it('should return true when copilot CLI is installed', async () => {
      mockExecuteCommand.mockResolvedValue({ stdout: '0.0.393', stderr: '' });
      const result = await copilotService.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when copilot CLI is not found', async () => {
      mockExecuteCommand.mockRejectedValue(new Error('command not found'));
      const result = await copilotService.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when stderr contains not found', async () => {
      mockExecuteCommand.mockResolvedValue({ stdout: '', stderr: 'copilot not found' });
      const result = await copilotService.isAvailable();
      expect(result).toBe(false);
    });

    it('should cache the availability result', async () => {
      mockExecuteCommand.mockResolvedValue({ stdout: '1.0.0', stderr: '' });
      await copilotService.isAvailable();
      await copilotService.isAvailable();
      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
    });

    it('should re-check after resetAvailability', async () => {
      mockExecuteCommand.mockResolvedValue({ stdout: '1.0.0', stderr: '' });
      await copilotService.isAvailable();
      copilotService.resetAvailability();
      await copilotService.isAvailable();
      expect(mockExecuteCommand).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateCommitMessage', () => {
    it('should return not available when copilot is not installed', async () => {
      mockExecuteCommand.mockRejectedValueOnce(new Error('not found'));
      const result = await copilotService.generateCommitMessage('diff content');
      expect(result.success).toBe(false);
    });

    it('should return failure for empty diff', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      const result = await copilotService.generateCommitMessage('');
      expect(result.success).toBe(false);
    });

    it('should parse conventional commit from output', async () => {
      // First call: version check
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      // Second call: generate message
      mockExecuteCommand.mockResolvedValueOnce({
        stdout: 'feat: add new authentication module',
        stderr: ''
      });

      const result = await copilotService.generateCommitMessage('diff --git a/auth.ts b/auth.ts\n+new code');
      expect(result.success).toBe(true);
      expect(result.message).toBe('feat: add new authentication module');
    });

    it('should parse commit message starting with verb', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      mockExecuteCommand.mockResolvedValueOnce({
        stdout: 'Add new authentication module for users',
        stderr: ''
      });

      const result = await copilotService.generateCommitMessage('diff --git a/auth.ts b/auth.ts\n+code');
      expect(result.success).toBe(true);
      expect(result.message).toBe('Add new authentication module for users');
    });

    it('should handle failed generation', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      mockExecuteCommand.mockRejectedValueOnce(new Error('timeout'));
      // Retry also fails
      mockExecuteCommand.mockRejectedValueOnce(new Error('timeout'));

      const result = await copilotService.generateCommitMessage('diff content here');
      expect(result.success).toBe(false);
    });
  });

  describe('askGitQuestion', () => {
    it('should return not available when copilot is not installed', async () => {
      mockExecuteCommand.mockRejectedValueOnce(new Error('not found'));
      const result = await copilotService.askGitQuestion('How do I rebase?');
      expect(result.success).toBe(false);
    });

    it('should return failure for empty question', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      const result = await copilotService.askGitQuestion('');
      expect(result.success).toBe(false);
    });

    it('should return answer from copilot', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      mockExecuteCommand.mockResolvedValueOnce({
        stdout: 'To rebase your branch, use git rebase main. This replays your commits on top of main.',
        stderr: ''
      });

      const result = await copilotService.askGitQuestion('How do I rebase?');
      expect(result.success).toBe(true);
      expect(result.message).toContain('rebase');
    });
  });

  describe('explainGitError', () => {
    it('should return not available when copilot is not installed', async () => {
      mockExecuteCommand.mockRejectedValueOnce(new Error('not found'));
      const result = await copilotService.explainGitError('fatal: remote origin already exists.');
      expect(result.success).toBe(false);
    });

    it('should return failure for empty error message', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      const result = await copilotService.explainGitError('');
      expect(result.success).toBe(false);
    });

    it('should return explanation from copilot', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      mockExecuteCommand.mockResolvedValueOnce({
        stdout: 'This error means a remote named origin is already configured. To fix it, use git remote set-url origin <new-url>.',
        stderr: ''
      });

      const result = await copilotService.explainGitError('fatal: remote origin already exists.');
      expect(result.success).toBe(true);
      expect(result.message).toContain('remote');
    });
  });

  describe('installCopilotCli', () => {
    it('should return success when install succeeds', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: 'installed', stderr: '' });
      // Version check after install
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });

      const result = await copilotService.installCopilotCli();
      expect(result.success).toBe(true);
    });

    it('should return failure when install fails', async () => {
      mockExecuteCommand.mockRejectedValueOnce(new Error('npm install failed'));

      const result = await copilotService.installCopilotCli();
      expect(result.success).toBe(false);
    });
  });

  describe('resetAvailability', () => {
    it('should clear cached availability', async () => {
      mockExecuteCommand.mockResolvedValue({ stdout: '1.0.0', stderr: '' });
      await copilotService.isAvailable();

      copilotService.resetAvailability();

      // Should call executeCommand again since cache is cleared
      mockExecuteCommand.mockResolvedValue({ stdout: '', stderr: 'not found' });
      const result = await copilotService.isAvailable();
      expect(result).toBe(false);
    });
  });
});
