import { describe, expect, it } from 'vitest';
import { chooseCoordinatorMode } from './coordinatorPublicUrl';

describe('coordinator transport mode', () => {
  it('prefers socket even when the coordinator is still on workers.dev', () => {
    expect(chooseCoordinatorMode('https://racing-worker.example.workers.dev', true)).toBe('socket');
  });

  it('prefers socket when a custom coordinator host is available', () => {
    expect(chooseCoordinatorMode('https://racing.example.com', true)).toBe('socket');
  });

  it('still returns socket when bridge is disabled but a valid worker host exists', () => {
    expect(chooseCoordinatorMode('https://racing-worker.example.workers.dev', false)).toBe('socket');
  });
});
