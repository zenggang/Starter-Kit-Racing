import { describe, expect, it } from 'vitest';
import { getViewportMode } from './viewportMode';

describe('viewport mode', () => {
  it('treats narrow portrait screens as blocked and landscape screens as playable', () => {
    expect(getViewportMode({ width: 430, height: 932 })).toBe('portrait-blocked');
    expect(getViewportMode({ width: 932, height: 430 })).toBe('landscape-playable');
  });
});
