/**
 * Guards the shared module mocks against drifting from the modules they stand
 * in for.
 *
 * A stub narrower than the real module does not fail where it is defined. It
 * fails much later, at the call site, as "x is not a function", and the mock
 * that caused it is nowhere in the stack. That happened once already: a shared
 * box stub missing `titleBox` broke the stats command tests.
 *
 * Under Jest the real modules could not be imported here at all — they pull in
 * chalk and ora — so their export surface was scraped out of the source with a
 * regex that only ever saw `export function` and `export const`. It missed
 * `export { coloredTheme, monochromeTheme }` entirely. Vitest loads the modules,
 * so the comparison is now against the modules themselves.
 */

import * as boxModule from '../../src/ui/components/box.js';
import * as promptModule from '../../src/ui/components/prompt.js';
import * as errorMapperModule from '../../src/utils/error-mapper.js';
import * as themesModule from '../../src/ui/themes/index.js';
import { logger as realLogger } from '../../src/utils/logger.js';
import {
  loggerMock,
  boxMock,
  promptMock,
  errorMapperMock,
  themeMock,
  spinnerMock
} from '../helpers/module-mocks.js';

/** Runtime exports of a module, minus the interop `default` key. */
function exportsOf(module: object): string[] {
  return Object.keys(module).filter(name => name !== 'default');
}

describe('shared module mocks', () => {
  it('should cover every export of the box module', () => {
    expect(Object.keys(boxMock())).toEqual(expect.arrayContaining(exportsOf(boxModule)));
  });

  it('should cover every export of the prompt module', () => {
    expect(Object.keys(promptMock())).toEqual(expect.arrayContaining(exportsOf(promptModule)));
  });

  it('should cover every export of the error mapper', () => {
    expect(Object.keys(errorMapperMock())).toEqual(
      expect.arrayContaining(exportsOf(errorMapperModule))
    );
  });

  it('should cover every export of the themes module', () => {
    expect(Object.keys(themeMock())).toEqual(expect.arrayContaining(exportsOf(themesModule)));
  });

  it('should cover every method of the logger', () => {
    expect(Object.keys(loggerMock().logger)).toEqual(
      expect.arrayContaining(Object.keys(realLogger))
    );
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
