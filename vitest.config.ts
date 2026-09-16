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
      // The figure moved 38 to 57 when branch, commit, undo, push and pull
      // gained real tests, which is the only way it is supposed to move. It
      // still says nothing about whether those tests are any good — the menus
      // above were checked by breaking them on purpose and watching the suites
      // fail, and that is the evidence, not this number. What it is good for is
      // spotting a file at zero, because a file at zero is untested, full stop.
      //
      // Set just under the current figures so a regression fails the build.
      thresholds: {
        branches: 55,
        functions: 59,
        lines: 60,
        statements: 60
      }
    }
  }
});
