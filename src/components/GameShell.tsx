'use client';

import React from 'react';
import { useCallback, useState } from 'react';
import { HallClient } from './HallClient';
import { LandscapeGate } from './LandscapeGate';
import { RaceClient } from './RaceClient';
import { ResultClient } from './ResultClient';
import { RoomClient } from './RoomClient';
import { TrackEditorClient } from './TrackEditorClient';

type GameScreen =
  | { name: 'hall' }
  | { name: 'room'; code: string }
  | { name: 'race'; code: string }
  | { name: 'result'; code: string }
  | { name: 'track-editor' };

/**
 * Fixed URL game shell for embedded browsers such as WeChat. Public routing now
 * stops at `/`; room, race, result, and editor movement is regular game
 * state so OAuth/JSSDK URL checks do not see every internal screen transition.
 */
export function GameShell() {
  const [screen, setScreen] = useState<GameScreen>({ name: 'hall' });

  const enterHall = useCallback(() => {
    setScreen({ name: 'hall' });
  }, []);

  const enterRoom = useCallback((code: string) => {
    setScreen({ name: 'room', code: code.toUpperCase() });
  }, []);

  const enterRace = useCallback((code: string) => {
    setScreen({ name: 'race', code: code.toUpperCase() });
  }, []);

  const enterResult = useCallback((code: string) => {
    setScreen({ name: 'result', code: code.toUpperCase() });
  }, []);

  const openTrackEditor = useCallback(() => {
    setScreen({ name: 'track-editor' });
  }, []);

  function renderScreen() {
    if (screen.name === 'hall') {
      return <HallClient onEnterRoom={enterRoom} onOpenTrackEditor={openTrackEditor} />;
    }

    if (screen.name === 'room') {
      return <RoomClient code={screen.code} onEnterRace={enterRace} onEnterResult={enterResult} onExitToHall={enterHall} />;
    }

    if (screen.name === 'race') {
      return <RaceClient code={screen.code} onEnterResult={enterResult} onReturnToRoom={enterRoom} onReturnToHall={enterHall} />;
    }

    if (screen.name === 'result') {
      return <ResultClient code={screen.code} onEnterRace={enterRace} onReturnToRoom={enterRoom} onReturnToHall={enterHall} />;
    }

    return <TrackEditorClient onBackToHall={enterHall} />;
  }

  return (
    <LandscapeGate suspendWhenBlocked>
      <main className="app-shell">{renderScreen()}</main>
    </LandscapeGate>
  );
}
