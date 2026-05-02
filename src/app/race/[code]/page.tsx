import { LandscapeGate } from '@/components/LandscapeGate';
import { LocalRaceTelemetryClient } from '@/components/LocalRaceTelemetryClient';
import { RaceClient } from '@/components/RaceClient';

export default async function RacePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalizedCode = code.toUpperCase();

  if (normalizedCode === 'DEMO') {
    return (
      <LandscapeGate>
        <LocalRaceTelemetryClient />
      </LandscapeGate>
    );
  }

  return (
    <LandscapeGate>
      <RaceClient code={normalizedCode} />
    </LandscapeGate>
  );
}
