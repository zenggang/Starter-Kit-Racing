import { Schema, defineTypes } from '@colyseus/schema';

export class RaceState extends Schema {
  roomCode = '';
  status = 'waiting';
}

defineTypes(RaceState, {
  roomCode: 'string',
  status: 'string'
});
