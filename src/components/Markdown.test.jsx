import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import Markdown from './Markdown.jsx';

describe('<Markdown>', () => {
  it('renders emphasis as real elements', () => {
    const { container } = render(
      <Markdown text="Follow *your home on campus* on **Instagram**" />
    );
    expect(container.querySelector('em').textContent).toBe('your home on campus');
    expect(container.querySelector('strong').textContent).toBe('Instagram');
    expect(container.textContent).toBe('Follow your home on campus on Instagram');
  });

  it('renders nothing for null copy', () => {
    const { container } = render(<Markdown text={null} />);
    expect(container.textContent).toBe('');
  });

  // This is the whole reason the renderer emits React nodes instead of an HTML
  // string: the copy is operator-entered and the board never reloads.
  it('does not execute or inject operator-supplied HTML', () => {
    const { container } = render(
      <Markdown text={'<img src=x onerror="alert(1)"> <script>alert(1)</script> *ok*'} />
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(container.querySelector('em').textContent).toBe('ok');
  });
});
