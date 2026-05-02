import { LandscapeGate } from '@/components/LandscapeGate';
import { LocalRaceTelemetryClient } from '@/components/LocalRaceTelemetryClient';
import { RaceClient } from '@/components/RaceClient';

export default async function RacePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalizedCode = code.toUpperCase();

  if (normalizedCode === 'DEMO') {
    return (
      <LandscapeGate suspendWhenBlocked>
        <LocalRaceTelemetryClient />
      </LandscapeGate>
    );
  }

  return (
    <LandscapeGate suspendWhenBlocked>
      <RaceClient code={normalizedCode} />
    </LandscapeGate>
  );
}
