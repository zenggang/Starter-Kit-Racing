import { RacingRuntimeHost } from '@/game/RacingRuntimeHost';

export default async function RacePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  return <RacingRuntimeHost roomCode={code.toUpperCase()} />;
}
