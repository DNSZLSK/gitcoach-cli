/**
 * Branch-level tests for the git error mapper.
 *
 * The mapper turns git's output into a sentence a beginner can act on, and it
 * does so through a table of patterns plus several input shapes. The existing
 * suite covered a few of those; these cover the input shapes that were never
 * exercised and the AI enrichment path, including its failure modes.
 */

jest.mock('../../src/i18n/index.js', () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key
}));

jest.mock('../../src/utils/logger.js', () =>
  require('../helpers/module-mocks.js').loggerMock());

jest.mock('../../src/services/ai/index.js', () => ({
  aiService: {
    isAvailable: jest.fn(),
    explainGitError: jest.fn()
  }
}));

import { mapGitError, mapGitErrorWithAI } from '../../src/utils/error-mapper.js';
import { aiService } from '../../src/services/ai/index.js';

const ai = aiService as jest.Mocked<typeof aiService>;

describe('error mapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ai.isAvailable.mockResolvedValue(false);
  });

  describe('input shapes', () => {
    it('should read the message off an Error', () => {
      expect(mapGitError(new Error('index.lock exists'))).toBe('errors.lockFileExists');
    });

    it('should accept a bare string', () => {
      expect(mapGitError('detached HEAD')).toBe('errors.detachedHead');
    });

    it('should handle null', () => {
      expect(mapGitError(null)).toContain('errors.');
    });

    it('should handle undefined', () => {
      expect(mapGitError(undefined)).toContain('errors.');
    });

    it('should stringify anything else', () => {
      expect(mapGitError({ weird: true })).toContain('errors.generic');
    });
  });

  describe('prefix cleaning', () => {
    it('should strip a fatal prefix before matching', () => {
      expect(mapGitError('fatal: disk full')).toBe('errors.diskFull');
    });

    it('should strip an error prefix', () => {
      expect(mapGitError('error: rate limit reached')).toBe('errors.rateLimited');
    });

    it('should strip a warning prefix', () => {
      const result = mapGitError('warning: something unrecognised');

      expect(result).toContain('errors.generic');
      // The prefix must not survive into the message shown to the user.
      expect(result).not.toContain('warning:');
    });
  });

  describe('pattern table', () => {
    it.each([
      ['index.lock', 'errors.lockFileExists'],
      ['rate limit exceeded', 'errors.rateLimited'],
      ['No space left on device', 'errors.diskFull'],
      ['You are in detached HEAD state', 'errors.detachedHead'],
      ['Updates were rejected', 'errors.pushRejected'],
      ['branch already exists', 'errors.alreadyExists'],
      ['pathspec did not match', 'errors.fileNotFound']
    ])('should map %s', (input, expected) => {
      expect(mapGitError(input)).toBe(expected);
    });

    it('should fall back to a generic message carrying the original text', () => {
      const result = mapGitError('something entirely unexpected');

      expect(result).toContain('errors.generic');
      expect(result).toContain('something entirely unexpected');
    });
  });

  describe('AI enrichment', () => {
    it('should return the static message when no provider is available', async () => {
      ai.isAvailable.mockResolvedValue(false);

      const result = await mapGitErrorWithAI(new Error('detached HEAD'));

      expect(result).toBe('errors.detachedHead');
      expect(ai.explainGitError).not.toHaveBeenCalled();
    });

    it('should append the explanation when the provider answers', async () => {
      ai.isAvailable.mockResolvedValue(true);
      ai.explainGitError.mockResolvedValue({ success: true, message: 'Pull first.' });

      const result = await mapGitErrorWithAI(new Error('Updates were rejected'));

      expect(result).toContain('errors.pushRejected');
      expect(result).toContain('Pull first.');
    });

    it('should keep the static message when the provider fails to answer', async () => {
      ai.isAvailable.mockResolvedValue(true);
      ai.explainGitError.mockResolvedValue({ success: false, message: '' });

      const result = await mapGitErrorWithAI(new Error('detached HEAD'));

      expect(result).toBe('errors.detachedHead');
    });

    it('should never let a provider error reach the user', async () => {
      // A broken AI provider must not turn a helpful message into a crash.
      ai.isAvailable.mockRejectedValue(new Error('provider exploded'));

      const result = await mapGitErrorWithAI(new Error('detached HEAD'));

      expect(result).toBe('errors.detachedHead');
    });

    it('should pass the context through to the provider', async () => {
      ai.isAvailable.mockResolvedValue(true);
      ai.explainGitError.mockResolvedValue({ success: true, message: 'ok' });

      await mapGitErrorWithAI(new Error('boom'), { command: 'git push', branch: 'main' });

      expect(ai.explainGitError).toHaveBeenCalledWith(
        'boom',
        expect.objectContaining({ command: 'git push', branch: 'main' })
      );
    });
  });
});
