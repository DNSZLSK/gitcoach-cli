/**
 * Mock Git Service for testing
 * Provides controllable git operations for integration tests
 */

import type { GitStatus, BranchInfo, CommitInfo } from '../../src/services/git-service.js';

export interface MockGitState {
  isRepo: boolean;
  currentBranch: string | null;
  tracking: string | null;
  branches: BranchInfo[];
  staged: string[];
  modified: string[];
  deleted: string[];
  untracked: string[];
  ahead: number;
  behind: number;
  commits: CommitInfo[];
  stashes: string[];
  detached: boolean;
}

export function createMockGitState(overrides: Partial<MockGitState> = {}): MockGitState {
  return {
    isRepo: true,
    currentBranch: 'main',
    tracking: 'origin/main',
    branches: [
      { name: 'main', current: true, commit: 'abc1234', label: 'main' }
    ],
    staged: [],
    modified: [],
    deleted: [],
    untracked: [],
    ahead: 0,
    behind: 0,
    commits: [],
    stashes: [],
    detached: false,
    ...overrides
  };
}

export function createMockGitService(initialState: Partial<MockGitState> = {}) {
  const state = createMockGitState(initialState);

  const mock = {
    // State management for tests
    get __state() {
      return state;
    },
    __setState: (newState: Partial<MockGitState>) => {
      Object.assign(state, newState);
    },
    __reset: () => {
      Object.assign(state, createMockGitState(initialState));
    },

    // Git service methods
    isGitRepo: jest.fn(async () => state.isRepo),

    getStatus: jest.fn(async (): Promise<GitStatus> => ({
      isClean: state.staged.length === 0 && state.modified.length === 0 &&
               state.deleted.length === 0 && state.untracked.length === 0,
      current: state.currentBranch,
      tracking: state.tracking,
      staged: state.staged,
      modified: state.modified,
      deleted: state.deleted,
      untracked: state.untracked,
      ahead: state.ahead,
      behind: state.behind
    })),

    getCurrentBranch: jest.fn(async () => state.currentBranch),

    isDetachedHead: jest.fn(async () => state.detached),

    getBranches: jest.fn(async () => state.branches),

    getStagedFiles: jest.fn(async () => state.staged),

    getUnstagedFiles: jest.fn(async () => [...state.modified, ...state.deleted]),

    hasUncommittedChanges: jest.fn(async () =>
      state.staged.length > 0 || state.modified.length > 0 ||
      state.deleted.length > 0 || state.untracked.length > 0
    ),

    hasUnpushedCommits: jest.fn(async () => {
      if (state.tracking) {
        return state.ahead > 0;
      }
      return state.commits.length > 0;
    }),

    getUnpushedCommitCount: jest.fn(async () => {
      if (state.tracking) {
        return state.ahead;
      }
      return state.commits.length;
    }),

    add: jest.fn(async (files: string[]) => {
      state.staged = [...state.staged, ...files];
      state.modified = state.modified.filter(f => !files.includes(f));
      state.untracked = state.untracked.filter(f => !files.includes(f));
    }),

    commit: jest.fn(async (message: string) => {
      const hash = Math.random().toString(36).substring(2, 9);
      state.commits.unshift({
        hash,
        date: new Date().toISOString(),
        message,
        author: 'Test User'
      });
      state.staged = [];
      state.ahead += 1;
      return hash;
    }),

    push: jest.fn(async (_remote?: string, _branch?: string, _force?: boolean, _setUpstream?: boolean) => {
      if (!state.tracking && _setUpstream) {
        state.tracking = `origin/${state.currentBranch}`;
      }
      state.ahead = 0;
    }),

    pull: jest.fn(async (_remote?: string, _branch?: string) => {
      state.behind = 0;
    }),

    checkout: jest.fn(async (branchOrFile: string) => {
      const branch = state.branches.find(b => b.name === branchOrFile);
      if (branch) {
        state.branches = state.branches.map(b => ({
          ...b,
          current: b.name === branchOrFile
        }));
        state.currentBranch = branchOrFile;
      }
    }),

    createBranch: jest.fn(async (name: string, checkout: boolean = false) => {
      const newBranch: BranchInfo = {
        name,
        current: checkout,
        commit: state.commits[0]?.hash || 'abc1234',
        label: name
      };
      if (checkout) {
        state.branches = state.branches.map(b => ({ ...b, current: false }));
        state.currentBranch = name;
      }
      state.branches.push(newBranch);
    }),

    deleteBranch: jest.fn(async (name: string) => {
      state.branches = state.branches.filter(b => b.name !== name);
    }),

    getLog: jest.fn(async (maxCount: number = 10) => {
      return state.commits.slice(0, maxCount);
    }),

    getDiff: jest.fn(async (_staged: boolean = false) => {
      return 'diff --git a/file.txt b/file.txt\n+added line';
    }),

    reset: jest.fn(async (mode: 'soft' | 'hard' | 'mixed', _target: string) => {
      if (mode === 'hard') {
        state.modified = [];
        state.staged = [];
      } else if (mode === 'soft') {
        // Keep files staged
      } else {
        state.staged = [];
      }
      if (state.commits.length > 0) {
        state.commits.shift();
        state.ahead = Math.max(0, state.ahead - 1);
      }
    }),

    stash: jest.fn(async (message?: string) => {
      state.stashes.unshift(message || `WIP on ${state.currentBranch}`);
      state.modified = [];
      state.staged = [];
      state.untracked = [];
    }),

    stashPop: jest.fn(async () => {
      if (state.stashes.length > 0) {
        state.stashes.shift();
      }
    }),

    stashApply: jest.fn(async (_index: number = 0) => {
      // Stash remains after apply
    }),

    stashDrop: jest.fn(async (index: number = 0) => {
      state.stashes.splice(index, 1);
    }),

    getStashList: jest.fn(async () => state.stashes),

    init: jest.fn(async () => {
      state.isRepo = true;
      state.currentBranch = 'main';
    }),

    addRemote: jest.fn(async (_name: string, _url: string) => {
      // Remote added
    }),

    clone: jest.fn(async (_url: string, _dir?: string) => {
      state.isRepo = true;
    })
  };

  return mock;
}

export type MockGitService = ReturnType<typeof createMockGitService>;
