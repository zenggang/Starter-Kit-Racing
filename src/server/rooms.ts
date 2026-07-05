export interface HallRoomSummary {
  code: string;
  lapTarget: number;
  trackName: string | null;
  trackScene: 'forest' | 'city';
  playerCount: number;
  expiresAt: string;
}
