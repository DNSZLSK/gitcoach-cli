/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // A ratchet, not a target.
  //
  // These numbers look like a collapse from 70% but nothing was deleted: the
  // measurement became honest. Jest only reports on files it loads, and until
  // the ESM dependencies were stubbed, no test could import most of src/ui. The
  // old 70% described the fourteen files tests happened to reach; this
  // describes all fifty-six that carry runtime code.
  //
  // Set just under the current figures so a regression fails the build. Raise
  // them as menus gain real tests; branch-menu, commit-menu, undo-menu and the
  // rest still sit under 20%.
  coverageThreshold: {
    global: {
      branches: 33,
      functions: 41,
      lines: 45,
      statements: 45
    }
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // chalk, ora and boxen are pure ESM and Jest will not transform them, so
    // any module reaching the logger, a theme or a box was unimportable from a
    // test. That is why most of src/ui went unmeasured. These stubs make those
    // modules importable, which is what coverage needs in order to see them.
    '^chalk$': '<rootDir>/test/stubs/chalk.js',
    '^ora$': '<rootDir>/test/stubs/ora.js',
    '^boxen$': '<rootDir>/test/stubs/boxen.js',
    // conf writes to the real user config directory, and the prompts package
    // waits for a human. Both are ESM too, so they are stubbed for the same
    // reason and replaced with something safe: an in-memory store, and prompts
    // that fail loudly rather than hang.
    '^conf$': '<rootDir>/test/stubs/conf.js',
    '^@inquirer/prompts$': '<rootDir>/test/stubs/inquirer-prompts.js'
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        // The project builds with module NodeNext, which ts-jest cannot use
        // here: it rejects `import.meta` and warns that the hybrid module kind
        // needs isolatedModules. test/tsconfig.json pins ESNext for the test
        // run only, leaving the shipped build untouched.
        tsconfig: '<rootDir>/test/tsconfig.json'
      }
    ]
  },
  // Prevent worker process leak warnings from timers/handles in ora/spinner
  forceExit: true
};
