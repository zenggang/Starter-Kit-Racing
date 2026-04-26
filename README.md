# Starter Kit Racing

A JavaScript/Three.js port of [Kenney's Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing).

[Live demo](https://mrdoob.github.io/Starter-Kit-Racing/)

## Online shell

Phase 1 adds a mobile-first Next.js shell for online room lifecycle work:

- `/` selects local demo mode when Supabase public env is missing.
- `/hall` creates and joins coordinator-backed rooms.
- `/room/[code]` handles color, ready and host start.
- `/race/[code]` mounts the existing Three.js racing runtime into the app shell.

The original static `index.html` and `editor.html` remain as compatibility entry points while the online shell is migrated.

## Development

```bash
npm install
npm run dev
```

Run checks:

```bash
npm run lint
npm run test
npm run build
```

See `docs/runbooks/phase-1-online-room-lifecycle.md` for Supabase, coordinator and mobile smoke verification.

## Credits

- Game assets by [Kenney](https://kenney.nl/) (CC0)
- Physics engine: [crashcat](https://github.com/isaac-mason/crashcat)
- Ported to JavaScript with [Claude](https://claude.ai/)
