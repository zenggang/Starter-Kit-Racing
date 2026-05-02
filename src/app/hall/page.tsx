import { HallClient } from '@/components/HallClient';
import { LandscapeGate } from '@/components/LandscapeGate';

export default function HallPage() {
  return (
    <LandscapeGate>
      <main className="app-shell">
        <HallClient />
      </main>
    </LandscapeGate>
  );
}
