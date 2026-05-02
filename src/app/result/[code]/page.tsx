import { ResultClient } from '@/components/ResultClient';
import { LandscapeGate } from '@/components/LandscapeGate';

export default async function ResultPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  return (
    <LandscapeGate>
      <main className="app-shell">
        <ResultClient code={code.toUpperCase()} />
      </main>
    </LandscapeGate>
  );
}
