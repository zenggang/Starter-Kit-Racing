# Supabase schema

Phase 1 uses Supabase as the durable room read model. The coordinator remains the only writer for room truth.

## Local migration

```bash
supabase db reset
```

## Tables

- `racing_rooms`: room code, host, status, lap target, default/custom track placeholder, timeout fields.
- `racing_room_players`: room members, selected color, ready state, host flag, last seen time.

Anonymous browser clients may only read waiting rooms that have not expired. Room creation, color selection, ready state, start and timeout closure must go through the coordinator or same-origin bridge.
