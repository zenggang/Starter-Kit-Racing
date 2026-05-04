import { describe, expect, it } from 'vitest';
import { resolveRuntimeGraphicsProfile } from './runtimeProfile.js';

describe('resolveRuntimeGraphicsProfile', () => {
  it('keeps the full renderer path for desktop default tracks', () => {
    expect(
      resolveRuntimeGraphicsProfile({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
        hasCustomTrack: false
      })
    ).toEqual({
      enablePostProcessing: true,
      enableLightProbeBake: true,
      maxPixelRatio: 2,
      observeVisualViewport: true
    });
  });

  it('skips the custom-track light probe bake even on desktop browsers', () => {
    expect(
      resolveRuntimeGraphicsProfile({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
        hasCustomTrack: true
      }).enableLightProbeBake
    ).toBe(false);
  });

  it('drops the risky half-float effect path on mobile webkit and wechat shells', () => {
    expect(
      resolveRuntimeGraphicsProfile({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49',
        hasCustomTrack: true
      })
    ).toEqual({
      enablePostProcessing: false,
      enableLightProbeBake: false,
      maxPixelRatio: 1.5,
      observeVisualViewport: false
    });
  });
});
