import { copilotService } from '../../src/services/copilot-service.js';

// Mock i18n
jest.mock('../../src/i18n/index.js', () => ({
  t: (key: string) => key
}));

// Mock i18next (used by getLanguageInstruction)
jest.mock('i18next', () => ({
  default: { language: 'en' },
  __esModule: true
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

    it('should accept context with command, branch and uncommitted info', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      mockExecuteCommand.mockResolvedValueOnce({
        stdout: 'The merge failed because you have uncommitted changes. Commit or stash them first.',
        stderr: ''
      });

      const result = await copilotService.explainGitError('merge failed', {
        command: 'git merge feature',
        branch: 'main',
        hasUncommitted: true
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('merge');
    });

    it('should fallback silently on timeout', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      mockExecuteCommand.mockRejectedValueOnce(new Error('timeout'));

      const result = await copilotService.explainGitError('some error');
      expect(result.success).toBe(false);
    });

    it('should return failure when output contains Command failed', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      mockExecuteCommand.mockResolvedValueOnce({
        stdout: 'Command failed with exit code 1: copilot -p "some prompt" -s',
        stderr: ''
      });

      const result = await copilotService.explainGitError('some git error');
      expect(result.success).toBe(false);
    });

    it('should return failure when output contains not compatible', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      mockExecuteCommand.mockResolvedValueOnce({
        stdout: 'Version not compatible with current CLI',
        stderr: ''
      });

      const result = await copilotService.explainGitError('some git error');
      expect(result.success).toBe(false);
    });
  });

  describe('suggestConflictResolution', () => {
    it('should return null when copilot is not available', async () => {
      mockExecuteCommand.mockRejectedValueOnce(new Error('not found'));
      const result = await copilotService.suggestConflictResolution('file.ts', 'local code', 'remote code');
      expect(result).toBeNull();
    });

    it('should parse structured recommendation response', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      mockExecuteCommand.mockResolvedValueOnce({
        stdout: 'RECOMMENDATION: LOCAL\nEXPLANATION: The local version has the latest bug fix that should be kept.',
        stderr: ''
      });

      const result = await copilotService.suggestConflictResolution('file.ts', 'local code', 'remote code');
      expect(result).not.toBeNull();
      expect(result!.recommendation).toBe('local');
      expect(result!.explanation).toContain('bug fix');
    });

    it('should parse CUSTOM recommendation with merged content', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      mockExecuteCommand.mockResolvedValueOnce({
        stdout: 'RECOMMENDATION: CUSTOM\nEXPLANATION: Both versions add important features.\nMERGED: combined code here',
        stderr: ''
      });

      const result = await copilotService.suggestConflictResolution('file.ts', 'local', 'remote');
      expect(result).not.toBeNull();
      expect(result!.recommendation).toBe('custom');
      expect(result!.customContent).toBe('combined code here');
    });

    it('should return null on timeout', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      mockExecuteCommand.mockRejectedValueOnce(new Error('timeout'));

      const result = await copilotService.suggestConflictResolution('file.ts', 'local', 'remote');
      expect(result).toBeNull();
    });

    it('should infer recommendation from free-text response', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      mockExecuteCommand.mockResolvedValueOnce({
        stdout: 'You should keep both versions since they contain complementary changes.',
        stderr: ''
      });

      const result = await copilotService.suggestConflictResolution('file.ts', 'local', 'remote');
      expect(result).not.toBeNull();
      expect(result!.recommendation).toBe('both');
    });

    it('should infer custom when free-text mentions merging both', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      mockExecuteCommand.mockResolvedValueOnce({
        stdout: 'I suggest a merged version that combines both changes for the best result.',
        stderr: ''
      });

      const result = await copilotService.suggestConflictResolution('file.ts', 'local', 'remote');
      expect(result).not.toBeNull();
      expect(result!.recommendation).toBe('custom');
    });

    it('should parse markdown-formatted structured output', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      mockExecuteCommand.mockResolvedValueOnce({
        stdout: '**RECOMMENDATION:** CUSTOM\n**EXPLANATION:** Merge both to keep all features.\n**MERGED:** merged code',
        stderr: ''
      });

      const result = await copilotService.suggestConflictResolution('file.ts', 'local', 'remote');
      expect(result).not.toBeNull();
      expect(result!.recommendation).toBe('custom');
      expect(result!.customContent).toBe('merged code');
    });

    it('should return null when output contains error text', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      mockExecuteCommand.mockResolvedValueOnce({
        stdout: 'Command failed with exit code 1',
        stderr: ''
      });

      const result = await copilotService.suggestConflictResolution('file.ts', 'local', 'remote');
      expect(result).toBeNull();
    });
  });

  describe('summarizeStagedDiff', () => {
    it('should return null when copilot is not available', async () => {
      mockExecuteCommand.mockRejectedValueOnce(new Error('not found'));
      const result = await copilotService.summarizeStagedDiff('diff content');
      expect(result).toBeNull();
    });

    it('should return null for empty diff', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      const result = await copilotService.summarizeStagedDiff('');
      expect(result).toBeNull();
    });

    it('should return summary from copilot', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      mockExecuteCommand.mockResolvedValueOnce({
        stdout: 'auth.ts: Added OAuth2 login flow\nconfig.ts: New env variable added',
        stderr: ''
      });

      const result = await copilotService.summarizeStagedDiff('diff --git a/auth.ts b/auth.ts\n+code');
      expect(result).not.toBeNull();
      expect(result).toContain('auth.ts');
    });

    it('should return null on timeout', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      mockExecuteCommand.mockRejectedValueOnce(new Error('timeout'));
      mockExecuteCommand.mockRejectedValueOnce(new Error('timeout'));

      const result = await copilotService.summarizeStagedDiff('diff content');
      expect(result).toBeNull();
    });

    it('should return null when output contains error text', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      mockExecuteCommand.mockResolvedValueOnce({
        stdout: 'error: Command failed with exit code 1: copilot -p "Summarize these staged Git changes" -s',
        stderr: ''
      });

      const result = await copilotService.summarizeStagedDiff('diff --git a/file.ts b/file.ts\n+code');
      expect(result).toBeNull();
    });

    it('should return null when stderr contains not compatible', async () => {
      mockExecuteCommand.mockResolvedValueOnce({ stdout: '1.0.0', stderr: '' });
      mockExecuteCommand.mockResolvedValueOnce({
        stdout: '',
        stderr: 'Version not compatible with the installed CLI'
      });

      const result = await copilotService.summarizeStagedDiff('diff --git a/file.ts b/file.ts\n+code');
      expect(result).toBeNull();
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
