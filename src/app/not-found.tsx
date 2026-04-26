import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="app-shell">
      <section className="stack">
        <h1>Not found</h1>
        <Link href="/">
          <button type="button">Back</button>
        </Link>
      </section>
    </main>
  );
}
