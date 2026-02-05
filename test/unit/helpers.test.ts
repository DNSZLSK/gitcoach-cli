import {
  truncateString,
  formatFileSize,
  formatDuration,
  pluralize,
  groupBy,
  extractFirstLine,
  normalizeLineEndings,
  isWindows
} from '../../src/utils/helpers.js';

describe('Helpers', () => {
  describe('truncateString', () => {
    it('should not truncate short strings', () => {
      expect(truncateString('hello', 10)).toBe('hello');
    });

    it('should truncate long strings with ellipsis', () => {
      expect(truncateString('hello world test', 10)).toBe('hello w...');
    });

    it('should handle exact length', () => {
      expect(truncateString('hello', 5)).toBe('hello');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500.0 B');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(5000)).toBe('5.0s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(125000)).toBe('2m 5s');
    });
  });

  describe('pluralize', () => {
    it('should use singular for count of 1', () => {
      expect(pluralize(1, 'file')).toBe('1 file');
    });

    it('should use plural for count > 1', () => {
      expect(pluralize(3, 'file')).toBe('3 files');
    });

    it('should use custom plural', () => {
      expect(pluralize(2, 'person', 'people')).toBe('2 people');
    });

    it('should use plural for count of 0', () => {
      expect(pluralize(0, 'file')).toBe('0 files');
    });
  });

  describe('groupBy', () => {
    it('should group items by key function', () => {
      const items = [
        { type: 'a', val: 1 },
        { type: 'b', val: 2 },
        { type: 'a', val: 3 }
      ];
      const result = groupBy(items, i => i.type);
      expect(result['a']).toHaveLength(2);
      expect(result['b']).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const result = groupBy([], () => 'key');
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('extractFirstLine', () => {
    it('should extract first line from multi-line text', () => {
      expect(extractFirstLine('first\nsecond\nthird')).toBe('first');
    });

    it('should return full text if no newline', () => {
      expect(extractFirstLine('single line')).toBe('single line');
    });
  });

  describe('normalizeLineEndings', () => {
    it('should convert CRLF to LF', () => {
      expect(normalizeLineEndings('line1\r\nline2\r\n')).toBe('line1\nline2\n');
    });

    it('should not change LF-only text', () => {
      expect(normalizeLineEndings('line1\nline2\n')).toBe('line1\nline2\n');
    });
  });

  describe('isWindows', () => {
    it('should return a boolean', () => {
      expect(typeof isWindows()).toBe('boolean');
    });
  });
});
