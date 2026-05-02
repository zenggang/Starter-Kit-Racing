import { describe, expect, it } from 'vitest';
import { advanceRaceProgress, buildTrackProgressModel, createInitialRaceProgressState } from './trackProgress';

function snapshotAt(x: number, z: number) {
  return {
    position: { x, y: 0.5, z },
    heading: 0,
    speed: 1,
    driftIntensity: 0
  };
}

describe('track progress anchors', () => {
  it('arms after leaving the start area and increments a lap when the finish line is crossed again', () => {
    const model = buildTrackProgressModel(null);
    let state = createInitialRaceProgressState();

    const farPoint = model.points[Math.floor(model.points.length / 2)];
    ({ state } = advanceRaceProgress(model, state, snapshotAt(farPoint.x, farPoint.z), 3));
    expect(state.finishLineArmed).toBe(true);

    const behind = snapshotAt(
      model.finishLine.point.x - model.finishLine.normal.x * 2,
      model.finishLine.point.z - model.finishLine.normal.z * 2
    );
    ({ state } = advanceRaceProgress(model, state, behind, 3));

    const ahead = snapshotAt(
      model.finishLine.point.x + model.finishLine.normal.x * 2,
      model.finishLine.point.z + model.finishLine.normal.z * 2
    );
    ({ state } = advanceRaceProgress(model, state, ahead, 3));

    expect(state.completedLaps).toBe(1);
    expect(state.finishLineArmed).toBe(false);
  });
});
