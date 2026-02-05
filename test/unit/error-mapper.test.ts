import { mapGitError } from '../../src/utils/error-mapper.js';

// Mock i18n to return the key as-is for testing
jest.mock('../../src/i18n/index.js', () => ({
  t: (key: string, params?: Record<string, unknown>) => {
    if (params && 'message' in params) {
      return `${key}:${params.message}`;
    }
    return key;
  }
}));

// Mock logger to suppress output
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

describe('Error Mapper', () => {
  describe('mapGitError', () => {
    it('should map authentication errors', () => {
      expect(mapGitError(new Error('Authentication failed for repo'))).toBe('errors.authenticationFailed');
      expect(mapGitError(new Error('could not read from remote repository'))).toBe('errors.authenticationFailed');
    });

    it('should map permission denied errors', () => {
      expect(mapGitError(new Error('Permission denied (publickey)'))).toBe('errors.permissionDenied');
      expect(mapGitError(new Error('EACCES: permission denied'))).toBe('errors.permissionDenied');
    });

    it('should map not a git repository errors', () => {
      expect(mapGitError(new Error('fatal: not a git repository'))).toBe('warnings.notGitRepo');
    });

    it('should map network errors', () => {
      expect(mapGitError(new Error('Could not resolve host: github.com'))).toBe('errors.networkError');
      expect(mapGitError(new Error('unable to access remote'))).toBe('errors.networkError');
      expect(mapGitError(new Error('Network is unreachable'))).toBe('errors.networkError');
    });

    it('should map merge conflict errors', () => {
      expect(mapGitError(new Error('CONFLICT (content): Merge conflict in file.ts'))).toBe('errors.mergeConflict');
    });

    it('should map disk full errors', () => {
      expect(mapGitError(new Error('No space left on device'))).toBe('errors.diskFull');
    });

    it('should map file not found errors', () => {
      expect(mapGitError(new Error("pathspec 'file.txt' did not match"))).toBe('errors.fileNotFound');
      expect(mapGitError(new Error('path does not exist'))).toBe('errors.fileNotFound');
    });

    it('should map already exists errors', () => {
      expect(mapGitError(new Error("branch 'main' already exists"))).toBe('errors.alreadyExists');
    });

    it('should map push rejected errors', () => {
      expect(mapGitError(new Error('rejected: non-fast-forward'))).toBe('errors.pushRejected');
      expect(mapGitError(new Error('push was rejected'))).toBe('errors.pushRejected');
    });

    it('should map detached head errors', () => {
      expect(mapGitError(new Error('You are in detached HEAD state'))).toBe('errors.detachedHead');
    });

    it('should map lock file errors', () => {
      expect(mapGitError(new Error('Unable to create index.lock'))).toBe('errors.lockFileExists');
      expect(mapGitError(new Error('fatal: lock file exists'))).toBe('errors.lockFileExists');
    });

    it('should map timeout errors', () => {
      expect(mapGitError(new Error('Connection timed out'))).toBe('errors.timeout');
      expect(mapGitError(new Error('timeout expired'))).toBe('errors.timeout');
    });

    it('should map rate limit errors', () => {
      expect(mapGitError(new Error('API rate limit exceeded'))).toBe('errors.rateLimited');
    });

    it('should be case-insensitive', () => {
      expect(mapGitError(new Error('AUTHENTICATION FAILED'))).toBe('errors.authenticationFailed');
      expect(mapGitError(new Error('permission DENIED'))).toBe('errors.permissionDenied');
      expect(mapGitError(new Error('CONFLICT in merge'))).toBe('errors.mergeConflict');
    });

    it('should fall back to generic error with cleaned message', () => {
      const result = mapGitError(new Error('some random git error'));
      expect(result).toBe('errors.generic:some random git error');
    });

    it('should clean error prefixes in fallback', () => {
      const result = mapGitError(new Error('fatal: some unknown error'));
      expect(result).toBe('errors.generic:some unknown error');
    });

    it('should handle string errors', () => {
      expect(mapGitError('Authentication failed')).toBe('errors.authenticationFailed');
    });

    it('should handle null errors', () => {
      const result = mapGitError(null);
      expect(result).toBe('errors.generic:errors.unknownError');
    });

    it('should handle undefined errors', () => {
      const result = mapGitError(undefined);
      expect(result).toBe('errors.generic:errors.unknownError');
    });

    it('should handle non-Error objects', () => {
      const result = mapGitError(42);
      expect(result).toBe('errors.generic:42');
    });
  });
});
