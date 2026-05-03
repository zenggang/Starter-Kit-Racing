import { describe, expect, it } from 'vitest';
import { computeBrowserViewportMetrics, detectBrowserShell } from './browserShell';

describe('browser shell metrics', () => {
  it('detects wechat user agents', () => {
    expect(detectBrowserShell('Mozilla/5.0 MicroMessenger/8.0.49')).toBe('wechat');
    expect(detectBrowserShell('Mozilla/5.0 Safari/605.1.15')).toBe('default');
  });

  it('marks short wechat landscape viewports as compact and uses visual viewport size', () => {
    expect(
      computeBrowserViewportMetrics({
        userAgent: 'Mozilla/5.0 MicroMessenger/8.0.49',
        innerWidth: 926,
        innerHeight: 430,
        visualViewport: {
          width: 926,
          height: 348
        }
      })
    ).toEqual({
      shell: 'wechat',
      compactLandscape: true,
      visibleWidth: 926,
      visibleHeight: 348
    });
  });

  it('keeps normal browsers out of the compact wechat layout', () => {
    expect(
      computeBrowserViewportMetrics({
        userAgent: 'Mozilla/5.0 Safari/605.1.15',
        innerWidth: 926,
        innerHeight: 430,
        visualViewport: {
          width: 926,
          height: 348
        }
      }).compactLandscape
    ).toBe(false);
  });
});
