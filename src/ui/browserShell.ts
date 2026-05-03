export type BrowserShell = 'default' | 'wechat';

export interface BrowserViewportMetrics {
  shell: BrowserShell;
  compactLandscape: boolean;
  visibleWidth: number;
  visibleHeight: number;
}

export function detectBrowserShell(userAgent: string): BrowserShell {
  return /MicroMessenger/i.test(userAgent) ? 'wechat' : 'default';
}

export function computeBrowserViewportMetrics({
  userAgent,
  innerWidth,
  innerHeight,
  visualViewport
}: {
  userAgent: string;
  innerWidth: number;
  innerHeight: number;
  visualViewport?: {
    width: number;
    height: number;
  } | null;
}): BrowserViewportMetrics {
  const shell = detectBrowserShell(userAgent);
  const visibleWidth = Math.max(1, Math.round(visualViewport?.width ?? innerWidth));
  const visibleHeight = Math.max(1, Math.round(visualViewport?.height ?? innerHeight));
  const compactLandscape = shell === 'wechat' && visibleWidth > visibleHeight && visibleHeight <= 560;

  return {
    shell,
    compactLandscape,
    visibleWidth,
    visibleHeight
  };
}
