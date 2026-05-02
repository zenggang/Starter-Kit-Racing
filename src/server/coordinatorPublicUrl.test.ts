import { describe, expect, it } from 'vitest';
import { chooseCoordinatorMode } from './coordinatorPublicUrl';

describe('coordinator transport mode', () => {
  it('uses bridge for workers.dev when enabled', () => {
    expect(chooseCoordinatorMode('https://racing-worker.example.workers.dev', true)).toBe('bridge');
  });

  it('prefers bridge when the same-origin fallback is enabled', () => {
    expect(chooseCoordinatorMode('https://racing.example.com', true)).toBe('bridge');
  });

  it('returns null when only an unsafe direct workers url is available', () => {
    expect(chooseCoordinatorMode('https://racing-worker.example.workers.dev', false)).toBeNull();
  });
});
