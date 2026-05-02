import { RaceClient } from '@/components/RaceClient';

export default async function RacePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  return <RaceClient code={code.toUpperCase()} />;
}
