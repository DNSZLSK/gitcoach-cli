/**
 * CommonJS stub for boxen, which is pure ESM.
 *
 * Returns the text with the title prepended when there is one, so assertions
 * can match on content rather than on box-drawing characters.
 */

function boxen(text, options) {
  const title = options && options.title;
  return title ? `${title}\n${text}` : String(text);
}

module.exports = boxen;
module.exports.default = boxen;
