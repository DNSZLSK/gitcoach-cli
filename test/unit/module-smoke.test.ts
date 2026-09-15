/**
 * Imports every source module once.
 *
 * Two jobs. First, it is a genuine smoke test: a module that throws while being
 * loaded, or that has a circular import, fails here rather than in front of a
 * user. Second, it makes coverage honest. Jest only reports on files it has
 * loaded, so before this existed the reported percentage described the fourteen
 * files tests happened to touch, not the fifty-seven the project ships.
 *
 * It asserts nothing about behaviour on purpose. The behaviour is covered by
 * the suites next to it; this one guards the act of loading.
 */

// src/i18n/index.ts uses `import.meta.url` to locate its locale files, which
// cannot be evaluated in the CommonJS mode the suite runs in. Jest's own mock
// machinery does not work in real ESM either, so the module is stubbed here and
// excluded from the list below; its behaviour is covered by translations.test.ts.
jest.mock('../../src/i18n/index.js', () => ({
  initI18n: jest.fn().mockResolvedValue(undefined),
  changeLanguage: jest.fn().mockResolvedValue(undefined),
  getCurrentLanguage: jest.fn().mockReturnValue('en'),
  t: (key: string) => key
}));

import { readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

/** Modules that cannot be loaded in this mode; see the note above. */
const EXCLUDED = new Set(['i18n/index.ts']);

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
  .filter(label => !EXCLUDED.has(label))
  .map(label => ({
    label,
    // Jest maps the .js suffix back to the TypeScript source.
    specifier: '../../src/' + label.replace(/\.ts$/, '.js')
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
