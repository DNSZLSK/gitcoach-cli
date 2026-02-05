import {
  parseConflictBlocks,
  resolveConflictBlock,
  hasConflictMarkers,
  ConflictBlock
} from '../../src/ui/menus/conflict-resolution-menu.js';

// Mock all dependencies (not needed for pure functions, but required for module loading)
jest.mock('../../src/i18n/index.js', () => ({
  t: (key: string) => key
}));

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

jest.mock('../../src/services/git-service.js', () => ({
  gitService: {
    getConflictedFiles: jest.fn(),
    add: jest.fn(),
    commit: jest.fn(),
    commitNoEdit: jest.fn()
  }
}));

jest.mock('../../src/ui/themes/index.js', () => ({
  getTheme: () => ({
    title: (s: string) => s,
    textBold: (s: string) => s,
    textMuted: (s: string) => s,
    info: (s: string) => s,
    warning: (s: string) => s,
    error: (s: string) => s,
    dim: (s: string) => s,
    file: (name: string) => name,
    commitHash: (h: string) => h,
    primary: (s: string) => s,
    menuItem: (k: string, l: string) => `${k} ${l}`
  })
}));

jest.mock('../../src/ui/components/box.js', () => ({
  successBox: (msg: string) => msg,
  warningBox: (msg: string) => msg,
  errorBox: (msg: string) => msg,
  infoBox: (msg: string) => msg
}));

jest.mock('../../src/ui/components/prompt.js', () => ({
  promptSelect: jest.fn(),
  promptConfirm: jest.fn(),
  promptInput: jest.fn()
}));

jest.mock('../../src/utils/error-mapper.js', () => ({
  mapGitError: (e: unknown) => String(e)
}));

jest.mock('../../src/ui/components/spinner.js', () => ({
  createSpinner: () => ({
    start: jest.fn(),
    stop: jest.fn(),
    succeed: jest.fn(),
    warn: jest.fn(),
    fail: jest.fn()
  }),
  withSpinner: jest.fn((_text: string, fn: () => Promise<unknown>) => fn())
}));

jest.mock('../../src/services/copilot-service.js', () => ({
  copilotService: {
    isAvailable: jest.fn().mockResolvedValue(false),
    suggestConflictResolution: jest.fn().mockResolvedValue(null)
  }
}));

describe('Conflict Resolution', () => {
  describe('parseConflictBlocks', () => {
    it('should parse a single conflict block', () => {
      const content = [
        'line before',
        '<<<<<<< HEAD',
        'local change',
        '=======',
        'remote change',
        '>>>>>>> origin/main',
        'line after'
      ].join('\n');

      const blocks = parseConflictBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].localContent).toBe('local change');
      expect(blocks[0].remoteContent).toBe('remote change');
      expect(blocks[0].startLine).toBe(1);
      expect(blocks[0].endLine).toBe(5);
    });

    it('should parse multiple conflict blocks', () => {
      const content = [
        'header',
        '<<<<<<< HEAD',
        'local A',
        '=======',
        'remote A',
        '>>>>>>> origin/main',
        'middle content',
        '<<<<<<< HEAD',
        'local B',
        '=======',
        'remote B',
        '>>>>>>> origin/main',
        'footer'
      ].join('\n');

      const blocks = parseConflictBlocks(content);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].localContent).toBe('local A');
      expect(blocks[0].remoteContent).toBe('remote A');
      expect(blocks[0].startLine).toBe(1);
      expect(blocks[0].endLine).toBe(5);
      expect(blocks[1].localContent).toBe('local B');
      expect(blocks[1].remoteContent).toBe('remote B');
      expect(blocks[1].startLine).toBe(7);
      expect(blocks[1].endLine).toBe(11);
    });

    it('should return empty array for clean file', () => {
      const content = 'no conflicts here\njust regular code\n';
      const blocks = parseConflictBlocks(content);
      expect(blocks).toHaveLength(0);
    });

    it('should handle multi-line content in blocks', () => {
      const content = [
        '<<<<<<< HEAD',
        'line 1 local',
        'line 2 local',
        'line 3 local',
        '=======',
        'line 1 remote',
        'line 2 remote',
        '>>>>>>> origin/main'
      ].join('\n');

      const blocks = parseConflictBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].localContent).toBe('line 1 local\nline 2 local\nline 3 local');
      expect(blocks[0].remoteContent).toBe('line 1 remote\nline 2 remote');
    });

    it('should handle empty local side', () => {
      const content = [
        '<<<<<<< HEAD',
        '=======',
        'only remote',
        '>>>>>>> origin/main'
      ].join('\n');

      const blocks = parseConflictBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].localContent).toBe('');
      expect(blocks[0].remoteContent).toBe('only remote');
    });

    it('should handle empty remote side', () => {
      const content = [
        '<<<<<<< HEAD',
        'only local',
        '=======',
        '>>>>>>> origin/main'
      ].join('\n');

      const blocks = parseConflictBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].localContent).toBe('only local');
      expect(blocks[0].remoteContent).toBe('');
    });

    it('should handle CRLF line endings', () => {
      const content =
        'line before\r\n<<<<<<< HEAD\r\nlocal change\r\n=======\r\nremote change\r\n>>>>>>> origin/main\r\nline after';

      const blocks = parseConflictBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].localContent).toBe('local change');
      expect(blocks[0].remoteContent).toBe('remote change');
    });

    it('should handle UTF-8 BOM', () => {
      const content = '\uFEFF<<<<<<< HEAD\nlocal\n=======\nremote\n>>>>>>> origin/main';

      const blocks = parseConflictBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].localContent).toBe('local');
      expect(blocks[0].remoteContent).toBe('remote');
    });

    it('should handle BOM + CRLF combined', () => {
      const content = '\uFEFFline before\r\n<<<<<<< HEAD\r\nlocal\r\n=======\r\nremote\r\n>>>>>>> main\r\nline after';

      const blocks = parseConflictBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].localContent).toBe('local');
      expect(blocks[0].remoteContent).toBe('remote');
    });
  });

  describe('resolveConflictBlock', () => {
    const baseContent = [
      'line before',
      '<<<<<<< HEAD',
      'local change',
      '=======',
      'remote change',
      '>>>>>>> origin/main',
      'line after'
    ].join('\n');

    const block: ConflictBlock = {
      localContent: 'local change',
      remoteContent: 'remote change',
      startLine: 1,
      endLine: 5
    };

    it('should keep local version', () => {
      const result = resolveConflictBlock(baseContent, block, 'local');
      expect(result).toBe('line before\nlocal change\nline after');
    });

    it('should keep remote version', () => {
      const result = resolveConflictBlock(baseContent, block, 'remote');
      expect(result).toBe('line before\nremote change\nline after');
    });

    it('should keep both versions', () => {
      const result = resolveConflictBlock(baseContent, block, 'both');
      expect(result).toBe('line before\nlocal change\nremote change\nline after');
    });

    it('should not modify content outside conflict block', () => {
      const result = resolveConflictBlock(baseContent, block, 'local');
      expect(result).toContain('line before');
      expect(result).toContain('line after');
      expect(result).not.toContain('<<<<<<<');
      expect(result).not.toContain('=======');
      expect(result).not.toContain('>>>>>>>');
    });

    it('should handle block at beginning of file', () => {
      const content = [
        '<<<<<<< HEAD',
        'local',
        '=======',
        'remote',
        '>>>>>>> origin/main',
        'rest of file'
      ].join('\n');

      const startBlock: ConflictBlock = {
        localContent: 'local',
        remoteContent: 'remote',
        startLine: 0,
        endLine: 4
      };

      const result = resolveConflictBlock(content, startBlock, 'local');
      expect(result).toBe('local\nrest of file');
    });

    it('should handle block at end of file', () => {
      const content = [
        'start of file',
        '<<<<<<< HEAD',
        'local',
        '=======',
        'remote',
        '>>>>>>> origin/main'
      ].join('\n');

      const endBlock: ConflictBlock = {
        localContent: 'local',
        remoteContent: 'remote',
        startLine: 1,
        endLine: 5
      };

      const result = resolveConflictBlock(content, endBlock, 'remote');
      expect(result).toBe('start of file\nremote');
    });
  });

  describe('hasConflictMarkers', () => {
    it('should detect conflict markers', () => {
      const content = '<<<<<<< HEAD\nlocal\n=======\nremote\n>>>>>>> main';
      expect(hasConflictMarkers(content)).toBe(true);
    });

    it('should return false for clean content', () => {
      expect(hasConflictMarkers('no conflicts')).toBe(false);
    });

    it('should return false for partial markers', () => {
      expect(hasConflictMarkers('<<<<<<< HEAD only start')).toBe(false);
      expect(hasConflictMarkers('>>>>>>> only end')).toBe(false);
    });

    it('should detect markers with CRLF', () => {
      const content = '<<<<<<< HEAD\r\nlocal\r\n=======\r\nremote\r\n>>>>>>> main';
      expect(hasConflictMarkers(content)).toBe(true);
    });

    it('should detect markers with BOM', () => {
      const content = '\uFEFF<<<<<<< HEAD\nlocal\n=======\nremote\n>>>>>>> main';
      expect(hasConflictMarkers(content)).toBe(true);
    });
  });
});
