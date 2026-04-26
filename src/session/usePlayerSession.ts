'use client';

import { useCallback, useEffect, useState } from 'react';
import { getOrCreatePlayerSession, rememberLastRoomCode, type PlayerSession } from './playerSession';

export function usePlayerSession(nickname?: string | null) {
  const [session, setSession] = useState<PlayerSession | null>(null);

  useEffect(() => {
    setSession(getOrCreatePlayerSession(window.localStorage, nickname));
  }, [nickname]);

  return {
    session,
    rememberRoom: useCallback((code: string) => {
      rememberLastRoomCode(window.localStorage, code);
      setSession(getOrCreatePlayerSession(window.localStorage, nickname));
    }, [nickname])
  };
}
