/**
 * In-memory stand-in for `conf`.
 *
 * This is the one module stub that survived the move to Vitest, and for a
 * different reason than the rest. chalk, ora, boxen and @inquirer/prompts were
 * stubbed because Jest would not transform their ESM; Vitest loads them for
 * real, so those stubs are gone. `conf` is stubbed because
 * `src/config/user-config.ts` constructs a store at module scope — importing it
 * writes to the developer's own config directory, and a test run has no
 * business doing that.
 *
 * Dot paths are supported, because that is how the real store is used:
 * `config.get('preferences.language')` reads through the nested defaults.
 */

type Store = Record<string, unknown>;

function readPath(store: Store, key: string): unknown {
  return key.split('.').reduce<unknown>((node, segment) => {
    if (node === null || typeof node !== 'object') return undefined;
    return (node as Store)[segment];
  }, store);
}

function writePath(store: Store, key: string, value: unknown): void {
  const segments = key.split('.');
  const last = segments.pop() as string;
  let node = store;
  for (const segment of segments) {
    if (node[segment] === null || typeof node[segment] !== 'object') {
      node[segment] = {};
    }
    node = node[segment] as Store;
  }
  node[last] = value;
}

export default class Conf<T extends Store = Store> {
  store: Store;

  private readonly defaults: Store;

  constructor(options: { defaults?: T; projectName?: string } = {}) {
    this.defaults = structuredClone(options.defaults ?? {});
    this.store = structuredClone(this.defaults);
  }

  get(key: string, fallback?: unknown): unknown {
    const value = readPath(this.store, key);
    return value === undefined ? fallback : value;
  }

  set(key: string | Store, value?: unknown): void {
    if (typeof key === 'object' && key !== null) {
      Object.assign(this.store, key);
      return;
    }
    writePath(this.store, key, value);
  }

  has(key: string): boolean {
    return readPath(this.store, key) !== undefined;
  }

  delete(key: string): void {
    const segments = key.split('.');
    const last = segments.pop() as string;
    const parent = segments.length ? readPath(this.store, segments.join('.')) : this.store;
    if (parent && typeof parent === 'object') {
      delete (parent as Store)[last];
    }
  }

  /** Reset to the defaults the caller passed, as the real conf does. */
  clear(): void {
    this.store = structuredClone(this.defaults);
  }

  get size(): number {
    return Object.keys(this.store).length;
  }

  get path(): string {
    return '<in-memory>';
  }
}

export { Conf };
