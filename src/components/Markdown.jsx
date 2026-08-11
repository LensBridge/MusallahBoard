/**
 * =====================================================
 * Markdown (inline only)
 * =====================================================
 * Renders the inline-Markdown token tree from
 * utils/markdown.js as React nodes.
 *
 * Nodes, not an HTML string: the copy this renders is
 * operator-entered and lands on a kiosk page that stays
 * open for weeks, so it never touches
 * dangerouslySetInnerHTML. React escapes every literal
 * character on the way out, and the only elements that can
 * ever appear are the <em>/<strong>/<br> this file emits.
 * =====================================================
 */

import { parseInlineMarkdown } from '../utils/markdown.js';

function toNodes(tokens) {
  return tokens.map((token, i) => {
    if (token.type === 'text') return token.value;
    if (token.type === 'break') return <br key={i} />;
    const Tag = token.type === 'strong' ? 'strong' : 'em';
    return <Tag key={i}>{toNodes(token.children)}</Tag>;
  });
}

/**
 * @param {object} props
 * @param {string|null|undefined} props.text  Markdown source
 */
export default function Markdown({ text }) {
  return <>{toNodes(parseInlineMarkdown(text))}</>;
}
