/**
 * CommonJS stub for ora, which is pure ESM.
 *
 * A spinner writes to a TTY and keeps a timer alive; a test wants neither. Each
 * method returns the spinner so chains behave, and `text` stays writable
 * because callers update it mid-task.
 */

function createSpinner(options) {
  const spinner = {
    text: typeof options === 'string' ? options : (options && options.text) || '',
    isSpinning: false,
    start(text) {
      if (text !== undefined) this.text = text;
      this.isSpinning = true;
      return this;
    },
    stop() {
      this.isSpinning = false;
      return this;
    },
    succeed(text) {
      if (text !== undefined) this.text = text;
      this.isSpinning = false;
      return this;
    },
    fail(text) {
      if (text !== undefined) this.text = text;
      this.isSpinning = false;
      return this;
    },
    warn(text) {
      if (text !== undefined) this.text = text;
      this.isSpinning = false;
      return this;
    },
    info(text) {
      if (text !== undefined) this.text = text;
      this.isSpinning = false;
      return this;
    },
    clear() {
      return this;
    },
    render() {
      return this;
    },
    stopAndPersist() {
      this.isSpinning = false;
      return this;
    }
  };
  return spinner;
}

module.exports = createSpinner;
module.exports.default = createSpinner;
module.exports.oraPromise = async (action) =>
  typeof action === 'function' ? action(createSpinner()) : action;
