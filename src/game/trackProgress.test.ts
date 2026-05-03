import { describe, expect, it } from 'vitest';
import { advanceRaceProgress, buildTrackProgressModel, createInitialRaceProgressState, sampleTrackProgress } from './trackProgress';

function snapshotAt(x: number, z: number) {
  return {
    position: { x, y: 0.5, z },
    heading: 0,
    speed: 1,
    driftIntensity: 0
  };
}

describe('track progress anchors', () => {
  it('increments a lap after traversing one full ordered loop', () => {
    const model = buildTrackProgressModel(null);
    let state = createInitialRaceProgressState();

    for (let index = 0; index < model.points.length; index += 1) {
      const point = model.points[index];
      ({ state } = advanceRaceProgress(model, state, snapshotAt(point.x, point.z), 3));
    }

    const finishReturn = snapshotAt(
      model.finishLine.point.x + model.finishLine.normal.x * 2,
      model.finishLine.point.z + model.finishLine.normal.z * 2
    );
    ({ state } = advanceRaceProgress(model, state, finishReturn, 3));

    expect(state.completedLaps).toBe(1);
    expect(state.finishLineArmed).toBe(false);
  });

  it('falls back to a global nearest-segment search when the checkpoint hint is too far away', () => {
    const model = buildTrackProgressModel(null);
    const point = model.points[0];
    const sample = sampleTrackProgress(model, { x: point.x, y: 0.5, z: point.z }, Math.floor(model.points.length / 2));

    expect(sample.checkpoint).toBe(0);
    expect(sample.normalizedProgress).toBeCloseTo(0, 5);
  });

  it('does not award a lap when the player reverses across the finish line before completing the loop', () => {
    const model = buildTrackProgressModel(null);
    let state = createInitialRaceProgressState();
    const checkpointBeforeFinish = (model.finishLine.checkpointIndex - 1 + model.checkpoints) % model.checkpoints;
    const previousPoint = model.points[checkpointBeforeFinish];
    const finishPoint = model.finishLine.point;
    const afterFinish = {
      x: finishPoint.x + model.finishLine.normal.x * 2,
      z: finishPoint.z + model.finishLine.normal.z * 2
    };

    ({ state } = advanceRaceProgress(model, state, snapshotAt(afterFinish.x, afterFinish.z), 3));
    ({ state } = advanceRaceProgress(model, state, snapshotAt(previousPoint.x, previousPoint.z), 3));
    ({ state } = advanceRaceProgress(model, state, snapshotAt(afterFinish.x, afterFinish.z), 3));

    expect(state.completedLaps).toBe(0);
  });
});
