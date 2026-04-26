import Link from 'next/link';
import { getPublicRuntimeMode } from '@/config/env';

export default function HomePage() {
  const mode = getPublicRuntimeMode();

  return (
    <main className="app-shell">
      <section className="stack">
        <div>
          <h1>Racing Online</h1>
          <p className="muted">Mobile-first room shell for Starter Kit Racing.</p>
        </div>

        {mode === 'demo' ? (
          <div className="surface stack">
            <h2>Local Demo Mode</h2>
            <p className="muted">Supabase public environment variables are not configured. The local racing demo remains available.</p>
            <Link href="/race/demo">
              <button type="button">Open Local Demo</button>
            </Link>
          </div>
        ) : (
          <div className="surface stack">
            <h2>Online Mode</h2>
            <p className="muted">Create or join a room through the coordinator-backed online shell.</p>
            <Link href="/hall">
              <button type="button">Open Hall</button>
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
