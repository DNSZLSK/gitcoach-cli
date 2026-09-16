import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // src/config/user-config.ts builds its store at module scope, so merely
  // importing it would write to the developer's real config directory. The
  // alias keeps that in memory. It is not an ESM workaround — see the note in
  // test/mocks/conf.ts.
  resolve: {
    alias: {
      conf: fileURLToPath(new URL('./test/mocks/conf.ts', import.meta.url))
    }
  },

  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],

    // The suites were written against Jest's injected globals. Keeping them
    // injected here is not laziness: `vi` and the assertion helpers read the
    // same at every call site, so the migration touched mocking, not the
    // thousand lines of arrangement around it.
    globals: true,

    // Vitest runs the source as ESM, which is the whole reason for the move.
    // Jest could not transform chalk, ora, boxen, conf or @inquirer/prompts, so
    // every module that reached a theme or a spinner was unimportable and
    // therefore unmeasured. The stubs and the moduleNameMapper that replaced
    // them are gone; the packages load for real.
    //
    // One stub survives, aliased above: conf, and for a reason unrelated to
    // ESM. See test/mocks/conf.ts.
    restoreMocks: true,

    // Several integration suites drive a real git in a temporary repo, and
    // spawning a process per command is slow on Windows — one of them makes
    // fifteen commits. The default five seconds was failing them for being
    // honest rather than for being wrong.
    testTimeout: 30_000,
    hookTimeout: 30_000,

    coverage: {
      provider: 'istanbul',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',

      // A ratchet, not a target.
      //
      // 38% reads like a fall from the 45% Jest reported, and again nothing was
      // deleted to cause it. ts-jest compiled `import` to `require()`, and
      // istanbul counted each of those calls as a statement that ran, so simply
      // loading a menu scored its import block. Vitest runs real ESM, where
      // imports are hoisted out of the module body and count for nothing. What
      // is left is the code that actually executed.
      //
      // Set just under the current figures so a regression fails the build.
      // Raise them as menus gain real tests; branch, commit, undo, push and
      // pull are still at zero.
      thresholds: {
        branches: 34,
        functions: 42,
        lines: 38,
        statements: 38
      }
    }
  }
});
