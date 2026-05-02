export type ViewportMode = 'portrait-blocked' | 'landscape-playable';

export function getViewportMode({ width, height }: { width: number; height: number }): ViewportMode {
  const isCompactScreen = Math.min(width, height) < 900;
  const isPortrait = height > width;

  return isCompactScreen && isPortrait ? 'portrait-blocked' : 'landscape-playable';
}
