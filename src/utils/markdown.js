/**
 * =====================================================
 * Inline Markdown
 * =====================================================
 * A deliberately small parser for the *inline* subset of
 * Markdown: emphasis, strong emphasis, hard line breaks,
 * and backslash escapes. Nothing else.
 *
 * Why not a real Markdown library: the only fields that
 * reach it are the socials frame's four copy fields, and
 * the only construct operators actually use is `*italic*`
 * ("Follow *your home on campus* ..."). Pulling marked or
 * markdown-it into a kiosk bundle to render four spans —
 * along with a sanitizer, because those emit raw HTML —
 * costs more than it buys.
 *
 * Security: this never produces an HTML string. It emits a
 * token tree that components/Markdown.jsx renders as React
 * nodes, so every literal character goes through React's
 * own escaping. There is no dangerouslySetInnerHTML path
 * for operator-entered copy to ride in on, which matters
 * for a page that stays open on a wall for weeks.
 * =====================================================
 */

/**
 * @typedef {{type:'text', value:string}} TextToken
 * @typedef {{type:'break'}} BreakToken
 * @typedef {{type:'em'|'strong', children:InlineToken[]}} EmphasisToken
 * @typedef {TextToken|BreakToken|EmphasisToken} InlineToken
 */

/**
 * Characters a backslash may escape. Anything else keeps its backslash, which
 * is what CommonMark does and what an operator typing a Windows path expects.
 */
const ESCAPABLE = '\\*_`[]()#+-.!';

/** Length of the run of `*` starting at `i`. */
function runLength(src, i) {
  let n = 0;
  while (src[i + n] === '*') n += 1;
  return n;
}

/**
 * Index of the delimiter run that closes an emphasis opened with `need`
 * asterisks, or -1 when the opener is unmatched (and so is literal text).
 *
 * A run longer than the one we opened with is only a closer when it can
 * actually absorb ours: `*a**b*` must not end the italic at the `**`.
 */
function findCloser(src, from, need) {
  let j = from;
  while (j < src.length) {
    if (src[j] === '\\') { j += 2; continue; }
    if (src[j] !== '*') { j += 1; continue; }
    const len = runLength(src, j);
    // A one-asterisk emphasis is closed only by a lone asterisk; a longer run
    // there belongs to a strong delimiter and is skipped over.
    if (len >= need && !(need === 1 && len > 1)) return j;
    j += len;
  }
  return -1;
}

/** Emphasis must hug its content: `*x*` is italic, `a * b * c` is arithmetic. */
const isSpace = (ch) => ch === undefined || /\s/.test(ch);

/**
 * Parse inline Markdown into a token tree.
 *
 * Unmatched or ambiguous delimiters degrade to literal text rather than
 * throwing — a stray asterisk in operator copy should look slightly wrong on
 * the board, not blank the slide.
 *
 * @param {string|null|undefined} src
 * @returns {InlineToken[]}
 */
export function parseInlineMarkdown(src) {
  const text = src == null ? '' : String(src);
  return parseRun(text);
}

/** @returns {InlineToken[]} */
function parseRun(src) {
  /** @type {InlineToken[]} */
  const out = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push({ type: 'text', value: buf });
    buf = '';
  };

  let i = 0;
  while (i < src.length) {
    const ch = src[i];

    if (ch === '\\' && ESCAPABLE.includes(src[i + 1] ?? '')) {
      buf += src[i + 1];
      i += 2;
      continue;
    }

    if (ch === '\n') {
      flush();
      out.push({ type: 'break' });
      i += 1;
      continue;
    }

    if (ch === '*') {
      // Three asterisks is bold-inside-italic; more than that is someone
      // drawing a divider, and falls through to literal text.
      const need = Math.min(runLength(src, i), 3);
      const from = i + need;
      if (!isSpace(src[from])) {
        const close = findCloser(src, from, need);
        if (close > from && !isSpace(src[close - 1])) {
          flush();
          const children = parseRun(src.slice(from, close));
          out.push(
            need === 1 ? { type: 'em', children }
              : need === 2 ? { type: 'strong', children }
                : { type: 'strong', children: [{ type: 'em', children }] }
          );
          i = close + need;
          continue;
        }
      }
    }

    buf += ch;
    i += 1;
  }

  flush();
  return out;
}

/**
 * Plain text of a token tree — the copy with its markup removed. Used where a
 * string is required rather than nodes (titles, aria labels, log lines).
 * @param {string|null|undefined} src
 */
export function inlineMarkdownToText(src) {
  const walk = (tokens) => tokens.map((t) => {
    if (t.type === 'text') return t.value;
    if (t.type === 'break') return '\n';
    return walk(t.children);
  }).join('');
  return walk(parseInlineMarkdown(src));
}
