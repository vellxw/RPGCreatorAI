import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SaveIndicator } from '../SaveIndicator';

describe('SaveIndicator', () => {
  it('shows a clear dirty but valid state', () => {
    const html = renderToStaticMarkup(<SaveIndicator dirty errorCount={0} warningCount={0} />);

    expect(html).toContain('Unsaved changes');
    expect(html).toContain('Save will validate first');
  });

  it('shows known validation errors as save-blocking', () => {
    const html = renderToStaticMarkup(<SaveIndicator dirty errorCount={2} warningCount={0} />);

    expect(html).toContain('2 validation errors');
    expect(html).toContain('Save blocked');
  });

  it('distinguishes warnings from blocking errors', () => {
    const html = renderToStaticMarkup(<SaveIndicator dirty={false} errorCount={0} warningCount={3} />);

    expect(html).toContain('3 warnings');
    expect(html).toContain('Save allowed');
  });

  it('shows an explicit saving state', () => {
    const html = renderToStaticMarkup(
      <SaveIndicator dirty errorCount={0} warningCount={0} saving />,
    );

    expect(html).toContain('Saving');
    expect(html).toContain('writing project data');
  });
});
