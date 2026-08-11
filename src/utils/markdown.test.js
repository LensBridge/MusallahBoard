import { describe, expect, it } from 'vitest';
import { inlineMarkdownToText, parseInlineMarkdown } from './markdown.js';

/** Compact shorthand so the expectations below read like the source they parse. */
const text = (value) => ({ type: 'text', value });
const em = (...children) => ({ type: 'em', children });
const strong = (...children) => ({ type: 'strong', children });

describe('parseInlineMarkdown', () => {
  it('returns a single text token for copy with no markup', () => {
    expect(parseInlineMarkdown('Catch the community.')).toEqual([
      text('Catch the community.'),
    ]);
  });

  it('treats null and undefined as empty', () => {
    expect(parseInlineMarkdown(null)).toEqual([]);
    expect(parseInlineMarkdown(undefined)).toEqual([]);
    expect(parseInlineMarkdown('')).toEqual([]);
  });

  it('parses the italic run the fields exist for', () => {
    expect(parseInlineMarkdown('Follow *your home on campus* on Instagram!')).toEqual([
      text('Follow '),
      em(text('your home on campus')),
      text(' on Instagram!'),
    ]);
  });

  it('parses bold, and prefers it over italic for a double delimiter', () => {
    expect(parseInlineMarkdown('a **b** c')).toEqual([
      text('a '), strong(text('b')), text(' c'),
    ]);
  });

  it('nests emphasis', () => {
    expect(parseInlineMarkdown('**bold with *italic* inside**')).toEqual([
      strong(text('bold with '), em(text('italic')), text(' inside')),
    ]);
    expect(parseInlineMarkdown('***both***')).toEqual([strong(em(text('both')))]);
  });

  it('leaves an unmatched delimiter as literal text', () => {
    expect(parseInlineMarkdown('5 * 3 = 15')).toEqual([text('5 * 3 = 15')]);
    expect(parseInlineMarkdown('half *open')).toEqual([text('half *open')]);
  });

  it('honours backslash escapes', () => {
    expect(parseInlineMarkdown('a \\*not italic\\* b')).toEqual([
      text('a *not italic* b'),
    ]);
  });

  it('turns newlines into hard breaks', () => {
    expect(parseInlineMarkdown('one\ntwo')).toEqual([
      text('one'), { type: 'break' }, text('two'),
    ]);
  });

  it('never yields a token type a renderer would have to guess at', () => {
    const src = 'A *b* **c** ***d*** \\* e\nf <script>alert(1)</script>';
    const seen = new Set();
    const walk = (tokens) => tokens.forEach((t) => {
      seen.add(t.type);
      if (t.children) walk(t.children);
    });
    walk(parseInlineMarkdown(src));
    expect([...seen].sort()).toEqual(['break', 'em', 'strong', 'text']);
  });
});

describe('inlineMarkdownToText', () => {
  it('strips markup', () => {
    expect(inlineMarkdownToText('Follow *your home on campus* today'))
      .toBe('Follow your home on campus today');
  });
});
