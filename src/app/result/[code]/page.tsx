import { ResultClient } from '@/components/ResultClient';

export default async function ResultPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  return (
    <main className="app-shell">
      <ResultClient code={code.toUpperCase()} />
    </main>
  );
}
