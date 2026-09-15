/**
 * CommonJS stub for conf, which is pure ESM.
 *
 * conf persists to a real file in the user's config directory. A test must
 * never touch that, so this keeps everything in memory: each instance gets its
 * own store, seeded with the defaults the caller passes, exactly as conf does.
 */

class Conf {
  constructor(options = {}) {
    this.store = { ...(options.defaults || {}) };
  }

  get(key, fallback) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : fallback;
  }

  set(key, value) {
    if (typeof key === 'object' && key !== null) {
      Object.assign(this.store, key);
      return;
    }
    this.store[key] = value;
  }

  has(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key);
  }

  delete(key) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }

  get size() {
    return Object.keys(this.store).length;
  }

  get path() {
    return '<in-memory>';
  }
}

module.exports = Conf;
module.exports.default = Conf;
module.exports.Conf = Conf;
