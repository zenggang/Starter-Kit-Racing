'use client';

import { useCallback, useEffect, useState } from 'react';
import { getOrCreatePlayerSession, rememberLastRoomCode, setStoredNickname, type PlayerSession } from './playerSession';

export function usePlayerSession() {
  const [session, setSession] = useState<PlayerSession | null>(null);

  useEffect(() => {
    setSession(getOrCreatePlayerSession(window.localStorage));
  }, []);

  return {
    session,
    rememberRoom: useCallback((code: string) => {
      rememberLastRoomCode(window.localStorage, code);
      setSession(getOrCreatePlayerSession(window.localStorage));
    }, []),
    updateNickname: useCallback((nickname: string) => {
      setStoredNickname(window.localStorage, nickname);
      setSession(getOrCreatePlayerSession(window.localStorage));
    }, [])
  };
}
