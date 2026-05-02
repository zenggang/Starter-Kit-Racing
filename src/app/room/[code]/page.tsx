import { RoomClient } from '@/components/RoomClient';
import { LandscapeGate } from '@/components/LandscapeGate';

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  return (
    <LandscapeGate suspendWhenBlocked>
      <main className="app-shell">
        <RoomClient code={code.toUpperCase()} />
      </main>
    </LandscapeGate>
  );
}
