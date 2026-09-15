/**
 * Shared module mocks.
 *
 * Several modules have to be replaced in almost every suite for the same
 * reason: chalk, boxen and ora ship ESM that Jest will not transform, and a
 * test has no business rendering to a terminal anyway. Repeating those factories
 * per file meant one stub definition per suite, so a change to any of them had
 * to be made everywhere.
 *
 * jest.mock factories are hoisted above imports and may not close over
 * out-of-scope variables, but they may `require`. So use them like this:
 *
 *     jest.mock('../../src/utils/logger.js', () =>
 *       require('../helpers/module-mocks.js').loggerMock());
 */

/** Logger stub. Every method is a jest.fn so calls can be asserted. */
export function loggerMock() {
  return {
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      success: jest.fn(),
      raw: jest.fn(),
      command: jest.fn()
    }
  };
}

/**
 * Theme stub: every accessor returns the value unchanged.
 *
 * A Proxy rather than a fixed list of methods, so adding a colour to the real
 * themes never breaks a test that does not care about colour.
 */
export function themeMock() {
  return {
    getTheme: () => new Proxy({}, { get: () => (value: string) => String(value) })
  };
}

/**
 * Box stub: returns the text, so assertions can match on content.
 *
 * Mirrors every export of src/ui/components/box.ts. A stub narrower than the
 * module it replaces fails at the call site with "is not a function", far from
 * the mock that caused it, so the full surface is kept here deliberately.
 */
export function boxMock() {
  const passthrough = (text: string) => text;
  return {
    createBox: passthrough,
    titleBox: passthrough,
    infoBox: passthrough,
    warningBox: passthrough,
    errorBox: passthrough,
    successBox: passthrough,
    banner: (version: string, tagline: string) => `${version} ${tagline}`
  };
}

/** Spinner stub. ora is ESM, and there is nothing to spin in a test. */
export function spinnerMock() {
  return {
    createSpinner: () => ({
      start: jest.fn(),
      stop: jest.fn(),
      succeed: jest.fn(),
      warn: jest.fn(),
      fail: jest.fn()
    }),
    withSpinner: async (_text: string, task: () => unknown) => task()
  };
}

/**
 * i18n stub returning the key itself, and the key plus its parameters when
 * interpolation is involved. Asserting on a key rather than on English prose
 * keeps tests from breaking when wording changes.
 */
export function i18nMock() {
  return {
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key
  };
}

/** Error mapper stub: passes the error through as a string. */
export function errorMapperMock() {
  return {
    mapGitError: (error: unknown) => String(error),
    mapGitErrorWithAI: async (error: unknown) => String(error)
  };
}

/**
 * Prompt stub. Tests drive these to simulate what the user chooses.
 *
 * Mirrors every export of src/ui/components/prompt.ts, for the same reason as
 * boxMock: a partial stub fails far from its cause.
 */
export function promptMock() {
  return {
    promptSelect: jest.fn(),
    promptInput: jest.fn(),
    promptConfirm: jest.fn(),
    promptCheckbox: jest.fn(),
    promptEditor: jest.fn()
  };
}
