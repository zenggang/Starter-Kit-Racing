import { HallClient } from '@/components/HallClient';
import { LandscapeGate } from '@/components/LandscapeGate';

export default function HallPage() {
  return (
    <LandscapeGate suspendWhenBlocked>
      <main className="app-shell">
        <HallClient />
      </main>
    </LandscapeGate>
  );
}
