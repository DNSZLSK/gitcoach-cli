/**
 * Branch-level tests for conflict parsing.
 *
 * The parser is a small state machine over a file's lines, and the paths that
 * matter are the awkward ones: files that arrive with a BOM or CRLF endings,
 * conflicts with an empty side, several conflicts in one file, and markers that
 * appear without forming a complete block. Those were the untested branches.
 */

jest.mock('../../src/i18n/index.js', () => ({
  t: (key: string) => key
}));

jest.mock('../../src/utils/logger.js', () =>
  require('../helpers/module-mocks.js').loggerMock());

jest.mock('../../src/ui/themes/index.js', () =>
  require('../helpers/module-mocks.js').themeMock());

jest.mock('../../src/ui/components/box.js', () =>
  require('../helpers/module-mocks.js').boxMock());

jest.mock('../../src/ui/components/prompt.js', () => ({
  promptSelect: jest.fn(),
  promptConfirm: jest.fn(),
  promptInput: jest.fn()
}));

// The menu module pulls in the spinner, and ora is ESM that Jest will not
// transform. Only the pure parsing functions are under test here.
jest.mock('../../src/ui/components/spinner.js', () =>
  require('../helpers/module-mocks.js').spinnerMock());

jest.mock('../../src/services/git-service.js', () => ({ gitService: {} }));
jest.mock('../../src/services/ai/index.js', () => ({ aiService: {} }));
jest.mock('../../src/utils/error-mapper.js', () => ({
  mapGitError: (error: unknown) => String(error)
}));

import {
  parseConflictBlocks,
  resolveConflictBlock,
  hasConflictMarkers
} from '../../src/ui/menus/conflict-resolution-menu.js';

const conflict = (local: string, remote: string) =>
  `<<<<<<< HEAD\n${local}\n=======\n${remote}\n>>>>>>> branch\n`;

describe('conflict parsing', () => {
  describe('parseConflictBlocks', () => {
    it('should find nothing in a clean file', () => {
      expect(parseConflictBlocks('just some text\n')).toEqual([]);
    });

    it('should read both sides of a conflict', () => {
      const [block] = parseConflictBlocks(conflict('mine', 'theirs'));

      expect(block.localContent).toBe('mine');
      expect(block.remoteContent).toBe('theirs');
    });

    it('should find several conflicts in one file', () => {
      const content = conflict('a', 'b') + 'middle\n' + conflict('c', 'd');

      const blocks = parseConflictBlocks(content);

      expect(blocks).toHaveLength(2);
      expect(blocks[1].localContent).toBe('c');
    });

    it('should keep multi-line sides intact', () => {
      const [block] = parseConflictBlocks(conflict('one\ntwo', 'three\nfour'));

      expect(block.localContent).toBe('one\ntwo');
      expect(block.remoteContent).toBe('three\nfour');
    });

    it('should handle a conflict whose local side is empty', () => {
      const [block] = parseConflictBlocks('<<<<<<< HEAD\n=======\ntheirs\n>>>>>>> b\n');

      expect(block.localContent).toBe('');
      expect(block.remoteContent).toBe('theirs');
    });

    it('should handle a conflict whose remote side is empty', () => {
      const [block] = parseConflictBlocks('<<<<<<< HEAD\nmine\n=======\n>>>>>>> b\n');

      expect(block.localContent).toBe('mine');
      expect(block.remoteContent).toBe('');
    });

    it('should ignore a start marker with no end marker', () => {
      // An unterminated block must not be reported as resolvable.
      expect(parseConflictBlocks('<<<<<<< HEAD\nmine\n')).toEqual([]);
    });

    it('should ignore a separator outside any conflict', () => {
      expect(parseConflictBlocks('a\n=======\nb\n')).toEqual([]);
    });

    it('should strip a UTF-8 BOM before parsing', () => {
      const [block] = parseConflictBlocks('﻿' + conflict('mine', 'theirs'));

      expect(block).toBeDefined();
      expect(block.localContent).toBe('mine');
    });

    it('should handle CRLF line endings', () => {
      const [block] = parseConflictBlocks(conflict('mine', 'theirs').replace(/\n/g, '\r\n'));

      expect(block.localContent).toBe('mine');
      expect(block.remoteContent).toBe('theirs');
    });

    it('should handle lone CR line endings', () => {
      const [block] = parseConflictBlocks(conflict('mine', 'theirs').replace(/\n/g, '\r'));

      expect(block.localContent).toBe('mine');
    });

    it('should record where the block starts and ends', () => {
      const [block] = parseConflictBlocks('first\n' + conflict('mine', 'theirs'));

      expect(block.startLine).toBe(1);
      expect(block.endLine).toBeGreaterThan(block.startLine);
    });
  });

  describe('resolveConflictBlock', () => {
    const content = conflict('mine', 'theirs');

    it('should keep the local side', () => {
      const [block] = parseConflictBlocks(content);

      const result = resolveConflictBlock(content, block, 'local');

      expect(result).toContain('mine');
      expect(result).not.toContain('theirs');
      expect(hasConflictMarkers(result)).toBe(false);
    });

    it('should keep the remote side', () => {
      const [block] = parseConflictBlocks(content);

      const result = resolveConflictBlock(content, block, 'remote');

      expect(result).toContain('theirs');
      expect(result).not.toContain('mine');
    });

    it('should keep both sides in order', () => {
      const [block] = parseConflictBlocks(content);

      const result = resolveConflictBlock(content, block, 'both');

      expect(result.indexOf('mine')).toBeLessThan(result.indexOf('theirs'));
      expect(hasConflictMarkers(result)).toBe(false);
    });

    it('should leave surrounding lines untouched', () => {
      const surrounded = 'before\n' + content + 'after\n';
      const [block] = parseConflictBlocks(surrounded);

      const result = resolveConflictBlock(surrounded, block, 'local');

      expect(result).toContain('before');
      expect(result).toContain('after');
    });

    it('should resolve only the block it was given', () => {
      const two = conflict('a', 'b') + conflict('c', 'd');
      const [first] = parseConflictBlocks(two);

      const result = resolveConflictBlock(two, first, 'local');

      // The second conflict is still there and still needs a decision.
      expect(hasConflictMarkers(result)).toBe(true);
      expect(result).toContain('c');
    });
  });

  describe('hasConflictMarkers', () => {
    it('should be false for clean content', () => {
      expect(hasConflictMarkers('nothing here\n')).toBe(false);
    });

    it('should be true for a complete conflict', () => {
      expect(hasConflictMarkers(conflict('a', 'b'))).toBe(true);
    });

    it('should be false when only a start marker is present', () => {
      expect(hasConflictMarkers('<<<<<<< HEAD\nmine\n')).toBe(false);
    });

    it('should be false when only an end marker is present', () => {
      expect(hasConflictMarkers('mine\n>>>>>>> branch\n')).toBe(false);
    });

    it('should see markers through a BOM and CRLF', () => {
      const messy = '﻿' + conflict('a', 'b').replace(/\n/g, '\r\n');

      expect(hasConflictMarkers(messy)).toBe(true);
    });
  });
});
