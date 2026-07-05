import { describe, expect, it } from 'vitest';
import { RoomCoordinator } from './RoomCoordinator.js';
import { InMemoryRoomStorage } from './storage.js';

function authTicket(playerId: string, roomCode?: string) {
  return {
    playerId,
    roomCode,
    issuedAt: 1_000,
    expiresAt: 10_000
  };
}

describe('RoomCoordinator vehicle selection', () => {
  it('stores car category and selected model on the room player and match player', async () => {
    const storage = new InMemoryRoomStorage();
    const coordinator = new RoomCoordinator(storage, {
      now: () => 2_000,
      roomCodeGenerator: () => '9191',
      matchIdGenerator: () => 'match-1'
    });

    await coordinator.execute({
      commandId: 'create',
      type: 'room.create',
      playerId: 'player-1',
      authTicket: authTicket('player-1'),
      payload: { nickname: '车手1' }
    });

    const selected = await coordinator.execute({
      commandId: 'vehicle',
      type: 'room.chooseVehicleType',
      playerId: 'player-1',
      authTicket: authTicket('player-1', '9191'),
      payload: { vehicleType: 'car', vehicleModel: 'mercedes-e' }
    });

    expect(selected.ok).toBe(true);
    expect(selected.room?.players[0]).toMatchObject({
      vehicleType: 'car',
      vehicleModel: 'mercedes-e'
    });

    const started = await coordinator.execute({
      commandId: 'start',
      type: 'room.start',
      playerId: 'player-1',
      authTicket: authTicket('player-1', '9191'),
      payload: {}
    });

    expect(started.ok).toBe(true);
    expect(started.match?.players[0]).toMatchObject({
      vehicleType: 'car',
      vehicleModel: 'mercedes-e'
    });
  });

  it('keeps legacy sedan commands compatible by mapping them to Mercedes car', async () => {
    const storage = new InMemoryRoomStorage();
    const coordinator = new RoomCoordinator(storage, {
      now: () => 2_000,
      roomCodeGenerator: () => '9192'
    });

    await coordinator.execute({
      commandId: 'create',
      type: 'room.create',
      playerId: 'player-1',
      authTicket: authTicket('player-1'),
      payload: { nickname: '车手1' }
    });

    const selected = await coordinator.execute({
      commandId: 'vehicle',
      type: 'room.chooseVehicleType',
      playerId: 'player-1',
      authTicket: authTicket('player-1', '9192'),
      payload: { vehicleType: 'sedan' }
    });

    expect(selected.ok).toBe(true);
    expect(selected.room?.players[0]).toMatchObject({
      vehicleType: 'car',
      vehicleModel: 'mercedes-e'
    });
  });
});
