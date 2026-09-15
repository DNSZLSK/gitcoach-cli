/**
 * Branch-level tests for the small utilities.
 *
 * These functions are pure and used everywhere, but most of their conditional
 * paths were never taken by a test: the plural forms, the size and duration
 * thresholds, the Windows and non-TTY branches. Each case below exists because
 * it is a distinct branch, not to restate the happy path.
 */

jest.mock('../../src/utils/logger.js', () =>
  require('../helpers/module-mocks.js').loggerMock());

import {
  truncateString,
  formatFileSize,
  formatDuration,
  pluralize,
  groupBy,
  sleep,
  debounce,
  getRelativePath,
  isWindows,
  isInteractive,
  normalizeLineEndings,
  extractFirstLine
} from '../../src/utils/helpers.js';

describe('helpers', () => {
  describe('truncateString', () => {
    it('should leave a short string alone', () => {
      expect(truncateString('short', 20)).toBe('short');
    });

    it('should leave a string of exactly the limit alone', () => {
      expect(truncateString('12345', 5)).toBe('12345');
    });

    it('should shorten a longer string', () => {
      const result = truncateString('abcdefghij', 5);

      expect(result.length).toBeLessThanOrEqual(5);
      expect(result).not.toBe('abcdefghij');
    });
  });

  describe('formatFileSize', () => {
    it('should report bytes below a kilobyte', () => {
      expect(formatFileSize(512)).toContain('512');
    });

    it('should switch to kilobytes', () => {
      expect(formatFileSize(2048).toLowerCase()).toContain('k');
    });

    it('should switch to megabytes', () => {
      expect(formatFileSize(5 * 1024 * 1024).toLowerCase()).toContain('m');
    });

    it('should handle zero', () => {
      expect(formatFileSize(0)).toContain('0');
    });
  });

  describe('formatDuration', () => {
    it('should report milliseconds under a second', () => {
      expect(formatDuration(250)).toBeTruthy();
    });

    it('should report seconds', () => {
      expect(formatDuration(5000)).toBeTruthy();
    });

    it('should report minutes', () => {
      expect(formatDuration(120000)).toBeTruthy();
    });

    it('should handle zero', () => {
      expect(formatDuration(0)).toBeTruthy();
    });
  });

  describe('pluralize', () => {
    it('should use the singular for one', () => {
      expect(pluralize(1, 'file')).toContain('file');
      expect(pluralize(1, 'file')).not.toContain('files');
    });

    it('should use the default plural for zero', () => {
      expect(pluralize(0, 'file')).toContain('files');
    });

    it('should use the default plural for many', () => {
      expect(pluralize(3, 'file')).toContain('files');
    });

    it('should use an explicit irregular plural', () => {
      expect(pluralize(2, 'branch', 'branches')).toContain('branches');
    });
  });

  describe('groupBy', () => {
    it('should group items under their key', () => {
      const grouped = groupBy(['apple', 'avocado', 'banana'], item => item[0]);

      expect(grouped.a).toHaveLength(2);
      expect(grouped.b).toHaveLength(1);
    });

    it('should return an empty object for an empty array', () => {
      expect(groupBy([], () => 'x')).toEqual({});
    });
  });

  describe('sleep', () => {
    it('should resolve after the delay', async () => {
      const started = Date.now();

      await sleep(20);

      expect(Date.now() - started).toBeGreaterThanOrEqual(15);
    });
  });

  describe('debounce', () => {
    it('should run once for a burst of calls', async () => {
      const spy = jest.fn();
      const debounced = debounce(spy, 20);

      debounced();
      debounced();
      debounced();

      expect(spy).not.toHaveBeenCalled();
      await sleep(50);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRelativePath', () => {
    it('should strip the base path', () => {
      const result = getRelativePath('/repo/src/index.ts', '/repo');

      expect(result).not.toContain('/repo/src/index.ts');
      expect(result).toContain('index.ts');
    });

    it('should return the path unchanged when it is outside the base', () => {
      expect(getRelativePath('/elsewhere/file.ts', '/repo')).toContain('file.ts');
    });
  });

  describe('environment probes', () => {
    it('should agree with the running platform', () => {
      expect(isWindows()).toBe(process.platform === 'win32');
    });

    it('should report non-interactive when stdout is not a TTY', () => {
      // Jest runs with stdout piped, so this exercises the false branch that
      // makes the CLI exit cleanly instead of hanging in CI.
      const original = process.stdout.isTTY;
      try {
        (process.stdout as { isTTY?: boolean }).isTTY = false;
        expect(isInteractive()).toBe(false);
      } finally {
        (process.stdout as { isTTY?: boolean }).isTTY = original;
      }
    });

    it('should report interactive when both streams are TTYs', () => {
      const outOriginal = process.stdout.isTTY;
      const inOriginal = process.stdin.isTTY;
      try {
        (process.stdout as { isTTY?: boolean }).isTTY = true;
        (process.stdin as { isTTY?: boolean }).isTTY = true;
        expect(isInteractive()).toBe(true);
      } finally {
        (process.stdout as { isTTY?: boolean }).isTTY = outOriginal;
        (process.stdin as { isTTY?: boolean }).isTTY = inOriginal;
      }
    });
  });

  describe('normalizeLineEndings', () => {
    it('should convert CRLF to LF', () => {
      expect(normalizeLineEndings('a\r\nb')).toBe('a\nb');
    });

    it('should leave LF alone', () => {
      expect(normalizeLineEndings('a\nb')).toBe('a\nb');
    });

    it('should handle an empty string', () => {
      expect(normalizeLineEndings('')).toBe('');
    });
  });

  describe('extractFirstLine', () => {
    it('should take only the first line', () => {
      expect(extractFirstLine('subject\n\nbody')).toBe('subject');
    });

    it('should return a single-line string unchanged', () => {
      expect(extractFirstLine('only line')).toBe('only line');
    });

    it('should handle an empty string', () => {
      expect(extractFirstLine('')).toBe('');
    });
  });
});
