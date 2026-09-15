/**
 * CommonJS stub for chalk.
 *
 * chalk v5 is pure ESM and Jest will not transform it, which meant no test
 * could import any module that reaches the logger or a theme. That is why most
 * of src/ui was never instrumented: not because it was untestable, but because
 * it was unimportable.
 *
 * Every style is the identity function, and any property access returns another
 * chainable style, so `chalk.bold.cyan('x')` works without listing colours.
 */

function createStyle() {
  const fn = text => String(text);
  return new Proxy(fn, {
    get(target, prop) {
      if (prop === 'level') return 0;
      if (prop in target) return target[prop];
      return createStyle();
    },
    apply(target, _thisArg, args) {
      return String(args[0] ?? '');
    }
  });
}

const chalk = createStyle();

module.exports = chalk;
module.exports.default = chalk;
module.exports.Chalk = function Chalk() {
  return createStyle();
};
module.exports.supportsColor = false;
