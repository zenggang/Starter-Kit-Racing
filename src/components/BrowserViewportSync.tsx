'use client';

import { useEffect } from 'react';
import { computeBrowserViewportMetrics } from '@/ui/browserShell';

/**
 * WeChat and similar in-app browsers often reserve visible space for their own
 * top and bottom bars after layout viewport calculation. Syncing the real
 * visual viewport into CSS variables lets every page size itself against the
 * actually visible rectangle instead of the optimistic full-screen box.
 */
export function BrowserViewportSync() {
  useEffect(() => {
    const root = document.documentElement;

    function syncViewportChrome() {
      const metrics = computeBrowserViewportMetrics({
        userAgent: navigator.userAgent,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        visualViewport: window.visualViewport
          ? {
              width: window.visualViewport.width,
              height: window.visualViewport.height
            }
          : null
      });

      root.dataset.browserShell = metrics.shell;
      root.dataset.browserCompact = metrics.compactLandscape ? 'true' : 'false';
      root.style.setProperty('--viewport-visible-width', `${metrics.visibleWidth}px`);
      root.style.setProperty('--viewport-visible-height', `${metrics.visibleHeight}px`);
    }

    syncViewportChrome();
    window.addEventListener('resize', syncViewportChrome);
    window.addEventListener('orientationchange', syncViewportChrome);
    window.visualViewport?.addEventListener('resize', syncViewportChrome);
    window.visualViewport?.addEventListener('scroll', syncViewportChrome);

    return () => {
      window.removeEventListener('resize', syncViewportChrome);
      window.removeEventListener('orientationchange', syncViewportChrome);
      window.visualViewport?.removeEventListener('resize', syncViewportChrome);
      window.visualViewport?.removeEventListener('scroll', syncViewportChrome);
    };
  }, []);

  return null;
}
