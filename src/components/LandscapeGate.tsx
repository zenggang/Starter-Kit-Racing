'use client';

import { useEffect, useState } from 'react';
import { getViewportMode, type ViewportMode } from '@/ui/viewportMode';

function readViewportMode(): ViewportMode {
  if (typeof window === 'undefined') {
    return 'landscape-playable';
  }

  return getViewportMode({
    width: window.innerWidth,
    height: window.innerHeight
  });
}

/**
 * Mobile Safari cannot be forced into landscape by the app, so the game keeps
 * the full UI mounted and overlays a hard rotate prompt whenever the viewport
 * falls back to portrait phone dimensions.
 */
export function LandscapeGate({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ViewportMode>(() => readViewportMode());

  useEffect(() => {
    function syncViewportMode() {
      setMode(readViewportMode());
    }

    syncViewportMode();
    window.addEventListener('resize', syncViewportMode);
    window.addEventListener('orientationchange', syncViewportMode);

    return () => {
      window.removeEventListener('resize', syncViewportMode);
      window.removeEventListener('orientationchange', syncViewportMode);
    };
  }, []);

  return (
    <>
      {children}
      {mode === 'portrait-blocked' ? (
        <div className="orientation-gate" role="dialog" aria-live="polite" aria-label="横屏提示">
          <div className="orientation-gate-card">
            <span className="panel-kicker">横屏体验</span>
            <strong>请横屏进入比赛</strong>
            <p className="muted">移动端当前只支持横屏渲染。旋转设备后即可看到完整大厅、房间和比赛界面。</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
