/**
 * Guards the shared module mocks against drifting from the modules they stand
 * in for.
 *
 * A stub narrower than the real module does not fail where it is defined. It
 * fails much later, at the call site, as "x is not a function", and the mock
 * that caused it is nowhere in the stack. That happened once already: a shared
 * box stub missing `titleBox` broke the stats command tests.
 *
 * The real modules cannot simply be imported here, because they pull in chalk
 * and ora, which ship ESM that Jest will not transform. So the export surface is
 * read from the source instead.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  loggerMock,
  boxMock,
  promptMock,
  errorMapperMock,
  themeMock,
  spinnerMock
} from '../helpers/module-mocks.js';

const SRC = join(__dirname, '..', '..', 'src');

/** Names exported with `export function` or `export const` from a module. */
function exportedNames(relativePath: string): string[] {
  const source = readFileSync(join(SRC, relativePath), 'utf-8');
  const names = [...source.matchAll(/^export\s+(?:async\s+)?(?:function|const)\s+(\w+)/gm)]
    .map(match => match[1]);
  return [...new Set(names)];
}

/** Public methods of the exported `logger` singleton. */
function loggerMethods(): string[] {
  const source = readFileSync(join(SRC, 'utils', 'logger.ts'), 'utf-8');
  const names = [...source.matchAll(/^ {2}([a-z][A-Za-z]*)\s*\(/gm)].map(match => match[1]);
  return [...new Set(names)];
}

describe('shared module mocks', () => {
  it('should cover every export of the box module', () => {
    const real = exportedNames(join('ui', 'components', 'box.ts'));

    expect(Object.keys(boxMock())).toEqual(expect.arrayContaining(real));
  });

  it('should cover every export of the prompt module', () => {
    const real = exportedNames(join('ui', 'components', 'prompt.ts'));

    expect(Object.keys(promptMock())).toEqual(expect.arrayContaining(real));
  });

  it('should cover every export of the error mapper', () => {
    const real = exportedNames(join('utils', 'error-mapper.ts'));

    expect(Object.keys(errorMapperMock())).toEqual(expect.arrayContaining(real));
  });

  it('should cover every export of the themes module', () => {
    const real = exportedNames(join('ui', 'themes', 'index.ts'));

    expect(Object.keys(themeMock())).toEqual(expect.arrayContaining(real));
  });

  it('should cover every method of the logger', () => {
    const real = loggerMethods();

    expect(Object.keys(loggerMock().logger)).toEqual(expect.arrayContaining(real));
  });

  it('should expose a spinner with the methods callers use', () => {
    const spinner = spinnerMock().createSpinner();

    for (const method of ['start', 'stop', 'succeed', 'warn', 'fail']) {
      expect(typeof (spinner as Record<string, unknown>)[method]).toBe('function');
    }
  });

  describe('stub behaviour', () => {
    it('should pass box text straight through, so assertions can match content', () => {
      expect(boxMock().infoBox('hello')).toBe('hello');
      expect(boxMock().titleBox('hello')).toBe('hello');
    });

    it('should return the theme value unchanged whatever accessor is used', () => {
      const theme = themeMock().getTheme() as Record<string, (value: string) => string>;

      // A Proxy, so a colour added to the real themes never breaks a test.
      expect(theme.title('x')).toBe('x');
      expect(theme.somethingInventedLater('x')).toBe('x');
    });

    it('should give every logger method a recorder', () => {
      const { logger } = loggerMock();

      logger.raw('printed');

      expect(logger.raw).toHaveBeenCalledWith('printed');
    });

    it('should run the task a spinner wraps', async () => {
      const { withSpinner } = spinnerMock();

      await expect(withSpinner('working', () => 'done')).resolves.toBe('done');
    });
  });
});
