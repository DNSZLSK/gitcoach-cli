import {
  isValidBranchName,
  isValidCommitMessage,
  isConventionalCommit,
  validateFilePath,
  isValidRemoteUrl,
  sanitizeInput
} from '../../src/utils/validators.js';

describe('Validators', () => {
  describe('isValidBranchName', () => {
    it('should accept valid branch names', () => {
      expect(isValidBranchName('main')).toBe(true);
      expect(isValidBranchName('feature/new-feature')).toBe(true);
      expect(isValidBranchName('bugfix-123')).toBe(true);
      expect(isValidBranchName('release-v1.0.0')).toBe(true);
    });

    it('should reject invalid branch names', () => {
      expect(isValidBranchName('')).toBe(false);
      expect(isValidBranchName('  ')).toBe(false);
      expect(isValidBranchName('.hidden')).toBe(false);
      expect(isValidBranchName('-starts-with-dash')).toBe(false);
      expect(isValidBranchName('has space')).toBe(false);
      expect(isValidBranchName('has~tilde')).toBe(false);
      expect(isValidBranchName('has^caret')).toBe(false);
      expect(isValidBranchName('has:colon')).toBe(false);
      expect(isValidBranchName('ends.lock')).toBe(false);
    });
  });

  describe('isValidCommitMessage', () => {
    it('should accept valid commit messages', () => {
      expect(isValidCommitMessage('fix: resolve bug')).toBe(true);
      expect(isValidCommitMessage('Add new feature')).toBe(true);
      expect(isValidCommitMessage('abc')).toBe(true);
    });

    it('should reject invalid commit messages', () => {
      expect(isValidCommitMessage('')).toBe(false);
      expect(isValidCommitMessage('  ')).toBe(false);
      expect(isValidCommitMessage('ab')).toBe(false);
    });

    it('should reject too long first line', () => {
      const longMessage = 'a'.repeat(101);
      expect(isValidCommitMessage(longMessage)).toBe(false);
    });
  });

  describe('isConventionalCommit', () => {
    it('should recognize conventional commit formats', () => {
      expect(isConventionalCommit('feat: add new feature')).toBe(true);
      expect(isConventionalCommit('fix: resolve bug')).toBe(true);
      expect(isConventionalCommit('docs: update readme')).toBe(true);
      expect(isConventionalCommit('style: format code')).toBe(true);
      expect(isConventionalCommit('refactor: clean up')).toBe(true);
      expect(isConventionalCommit('perf: improve speed')).toBe(true);
      expect(isConventionalCommit('test: add tests')).toBe(true);
      expect(isConventionalCommit('chore: update deps')).toBe(true);
    });

    it('should recognize conventional commits with scope', () => {
      expect(isConventionalCommit('feat(auth): add login')).toBe(true);
      expect(isConventionalCommit('fix(api): handle error')).toBe(true);
    });

    it('should recognize breaking changes', () => {
      expect(isConventionalCommit('feat!: breaking change')).toBe(true);
      expect(isConventionalCommit('feat(api)!: breaking change')).toBe(true);
    });

    it('should reject non-conventional commits', () => {
      expect(isConventionalCommit('Add new feature')).toBe(false);
      expect(isConventionalCommit('fixed bug')).toBe(false);
      expect(isConventionalCommit('FEAT: uppercase')).toBe(true); // case insensitive
    });
  });

  describe('validateFilePath', () => {
    it('should accept valid file paths', () => {
      expect(validateFilePath('src/index.ts').valid).toBe(true);
      expect(validateFilePath('path/to/file.txt').valid).toBe(true);
    });

    it('should reject empty paths', () => {
      const result = validateFilePath('');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject paths with invalid characters', () => {
      const result = validateFilePath('file<name>.txt');
      expect(result.valid).toBe(false);
    });
  });

  describe('isValidRemoteUrl', () => {
    it('should accept valid HTTPS URLs', () => {
      expect(isValidRemoteUrl('https://github.com/user/repo.git')).toBe(true);
    });

    it('should accept valid SSH URLs', () => {
      expect(isValidRemoteUrl('git@github.com:user/repo.git')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidRemoteUrl('')).toBe(false);
      expect(isValidRemoteUrl('not-a-url')).toBe(false);
      expect(isValidRemoteUrl('http://github.com/repo')).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeInput('normal text')).toBe('normal text');
      expect(sanitizeInput('text; rm -rf /')).toBe('text rm -rf /');
      expect(sanitizeInput('$(command)')).toBe('command');
      expect(sanitizeInput('`backtick`')).toBe('backtick');
    });
  });
});
