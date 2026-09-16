/**
 * Imports every source module once.
 *
 * Two jobs. First, it is a genuine smoke test: a module that throws while being
 * loaded, or that has a circular import, fails here rather than in front of a
 * user. Second, it proves the whole tree is reachable from a test at all —
 * which, under Jest, most of it was not.
 *
 * It asserts nothing about behaviour on purpose. The behaviour is covered by
 * the suites next to it; this one guards the act of loading. Note that loading
 * a module is worth almost nothing to coverage under real ESM: imports are
 * hoisted out of the module body, so a menu whose whole content sits inside a
 * function still reports zero here. That is correct, and it is why this file
 * makes no claim about coverage.
 */

import { readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

/** Every .ts file under src, excluding declaration files. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return entry.endsWith('.ts') && !entry.endsWith('.d.ts') ? [full] : [];
  });
}

const modules = sourceFiles(SRC)
  .map(file => relative(SRC, file).split(sep).join('/'))
  .map(label => ({
    label,
    // Vite resolves the .js suffix back to the TypeScript source.
    specifier: '../../src/' + label.replace(/[.]ts$/, '.js')
  }));

describe('module loading', () => {
  it('should find the source files to load', () => {
    // A silent zero here would make every case below vacuously pass.
    expect(modules.length).toBeGreaterThan(40);
  });

  it.each(modules.map(m => [m.label, m.specifier]))(
    'should load %s without throwing',
    async (_label, specifier) => {
      await expect(import(specifier as string)).resolves.toBeDefined();
    }
  );
});
