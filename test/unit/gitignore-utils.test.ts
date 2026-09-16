import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  GITIGNORE_TEMPLATES,
  addPatterns,
  hasGitignore,
  hasPattern,
  readGitignore,
  readPatterns,
  removePattern,
  writeTemplate
} from '../../src/utils/gitignore.js';

/**
 * These run against a real directory rather than a mocked fs.
 *
 * The bugs worth catching here are all about what ends up on disk: a pattern
 * glued to the previous line because the file had no trailing newline, a
 * duplicate written because the existing one had a trailing space, a
 * hand-written comment lost because the file was rewritten instead of
 * appended to. A mocked filesystem would accept all three.
 */

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'gitcoach-ignore-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const write = (contents: string) => writeFileSync(join(root, '.gitignore'), contents, 'utf-8');
const read = () => readFileSync(join(root, '.gitignore'), 'utf-8');

describe('reading a .gitignore', () => {
  it('should report no file before one exists', () => {
    expect(hasGitignore(root)).toBe(false);
    expect(readGitignore(root)).toBe('');
    expect(readPatterns(root)).toEqual([]);
  });

  it('should skip comments and blank lines', () => {
    write('# deps\nnode_modules/\n\n# build\ndist/\n');

    expect(readPatterns(root)).toEqual(['node_modules/', 'dist/']);
  });

  it('should trim whitespace git would ignore anyway', () => {
    write('  dist/  \n\t.env\n');

    expect(readPatterns(root)).toEqual(['dist/', '.env']);
  });

  it('should read a file written with CRLF line endings', () => {
    write('node_modules/\r\ndist/\r\n');

    expect(readPatterns(root)).toEqual(['node_modules/', 'dist/']);
  });
});

describe('adding patterns', () => {
  it('should create the file when there is none', () => {
    const added = addPatterns(root, ['dist/']);

    expect(added).toEqual(['dist/']);
    expect(read()).toBe('dist/\n');
  });

  it('should keep what is already there, comments included', () => {
    write('# hand written\nnode_modules/\n');

    addPatterns(root, ['dist/']);

    expect(read()).toBe('# hand written\nnode_modules/\ndist/\n');
  });

  it('should not glue the new pattern onto a file with no trailing newline', () => {
    write('node_modules/');

    addPatterns(root, ['dist/']);

    expect(read()).toBe('node_modules/\ndist/\n');
    expect(readPatterns(root)).toEqual(['node_modules/', 'dist/']);
  });

  it('should not add a pattern that is already there', () => {
    write('dist/\n');

    const added = addPatterns(root, ['dist/']);

    expect(added).toEqual([]);
    expect(read()).toBe('dist/\n');
  });

  it('should treat a pattern with stray whitespace as the same pattern', () => {
    write('  dist/  \n');

    expect(addPatterns(root, ['dist/'])).toEqual([]);
  });

  it('should not write the same pattern twice in one call', () => {
    const added = addPatterns(root, ['dist/', 'dist/', ' dist/ ']);

    expect(added).toEqual(['dist/']);
    expect(read()).toBe('dist/\n');
  });

  it('should add only the ones that are new', () => {
    write('node_modules/\n');

    const added = addPatterns(root, ['node_modules/', '.env', 'dist/']);

    expect(added).toEqual(['.env', 'dist/']);
    expect(readPatterns(root)).toEqual(['node_modules/', '.env', 'dist/']);
  });

  it('should ignore empty input rather than write a blank line', () => {
    write('dist/\n');

    expect(addPatterns(root, ['', '   '])).toEqual([]);
    expect(read()).toBe('dist/\n');
  });

  it('should not touch the file at all when nothing is new', () => {
    write('dist/');
    const before = read();

    addPatterns(root, ['dist/']);

    expect(read()).toBe(before);
  });
});

describe('hasPattern', () => {
  it('should find a pattern regardless of surrounding whitespace', () => {
    write('  dist/  \n');

    expect(hasPattern(root, 'dist/')).toBe(true);
    expect(hasPattern(root, ' dist/ ')).toBe(true);
    expect(hasPattern(root, 'build/')).toBe(false);
  });

  it('should not match a comment that mentions the pattern', () => {
    write('# dist/\n');

    expect(hasPattern(root, 'dist/')).toBe(false);
  });
});

describe('removing a pattern', () => {
  it('should remove the line and leave the rest alone', () => {
    write('# deps\nnode_modules/\ndist/\n');

    expect(removePattern(root, 'node_modules/')).toBe(true);
    expect(read()).toBe('# deps\ndist/\n');
  });

  it('should report false for a pattern that is not there', () => {
    write('dist/\n');

    expect(removePattern(root, 'build/')).toBe(false);
    expect(read()).toBe('dist/\n');
  });

  it('should report false when there is no file', () => {
    expect(removePattern(root, 'dist/')).toBe(false);
  });

  it('should not remove a comment that mentions the pattern', () => {
    write('# dist/\ndist/\n');

    removePattern(root, 'dist/');

    expect(read()).toBe('# dist/\n');
  });

  it('should remove every occurrence of a duplicated pattern', () => {
    write('dist/\nbuild/\ndist/\n');

    expect(removePattern(root, 'dist/')).toBe(true);
    expect(readPatterns(root)).toEqual(['build/']);
  });
});

describe('templates', () => {
  it('should offer one for each kind of project', () => {
    expect(Object.keys(GITIGNORE_TEMPLATES).sort()).toEqual([
      'generic',
      'java',
      'node',
      'python'
    ]);
  });

  it('should write the template over whatever was there', () => {
    write('mine\n');

    writeTemplate(root, 'node');

    expect(read()).toBe(GITIGNORE_TEMPLATES.node);
    expect(readPatterns(root)).toContain('node_modules/');
    expect(readPatterns(root)).not.toContain('mine');
  });

  it('should produce a file the reader can parse back', () => {
    for (const name of Object.keys(GITIGNORE_TEMPLATES) as Array<
      keyof typeof GITIGNORE_TEMPLATES
    >) {
      writeTemplate(root, name);
      expect(readPatterns(root).length).toBeGreaterThan(3);
    }
  });

  it('should keep secrets out of every template', () => {
    for (const name of Object.keys(GITIGNORE_TEMPLATES) as Array<
      keyof typeof GITIGNORE_TEMPLATES
    >) {
      writeTemplate(root, name);
      expect(readPatterns(root)).toContain('.env');
    }
  });
});
