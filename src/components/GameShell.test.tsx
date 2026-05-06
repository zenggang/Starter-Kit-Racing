import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameShell } from './GameShell';

vi.mock('./LandscapeGate', () => ({
  LandscapeGate: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock('./HallClient', () => ({
  HallClient: ({
    onEnterRoom,
    onOpenTrackEditor
  }: {
    onEnterRoom(code: string): void;
    onOpenTrackEditor(): void;
  }) => (
    <section>
      <span>mock hall</span>
      <button type="button" onClick={() => onEnterRoom('8966')}>
        mock enter room
      </button>
      <button type="button" onClick={onOpenTrackEditor}>
        mock track editor
      </button>
    </section>
  )
}));

vi.mock('./RoomClient', () => ({
  RoomClient: ({
    code,
    onEnterRace,
    onEnterResult,
    onExitToHall
  }: {
    code: string;
    onEnterRace(code: string): void;
    onEnterResult(code: string): void;
    onExitToHall(): void;
  }) => (
    <section>
      <span>mock room {code}</span>
      <button type="button" onClick={() => onEnterRace(code)}>
        mock start race
      </button>
      <button type="button" onClick={() => onEnterResult(code)}>
        mock room result
      </button>
      <button type="button" onClick={onExitToHall}>
        mock room hall
      </button>
    </section>
  )
}));

vi.mock('./RaceClient', () => ({
  RaceClient: ({
    code,
    onEnterResult,
    onReturnToRoom,
    onReturnToHall
  }: {
    code: string;
    onEnterResult(code: string): void;
    onReturnToRoom(code: string): void;
    onReturnToHall(): void;
  }) => (
    <section>
      <span>mock race {code}</span>
      <button type="button" onClick={() => onEnterResult(code)}>
        mock finish race
      </button>
      <button type="button" onClick={() => onReturnToRoom(code)}>
        mock race room
      </button>
      <button type="button" onClick={onReturnToHall}>
        mock race hall
      </button>
    </section>
  )
}));

vi.mock('./ResultClient', () => ({
  ResultClient: ({
    code,
    onEnterRace,
    onReturnToRoom,
    onReturnToHall
  }: {
    code: string;
    onEnterRace(code: string): void;
    onReturnToRoom(code: string): void;
    onReturnToHall(): void;
  }) => (
    <section>
      <span>mock result {code}</span>
      <button type="button" onClick={() => onEnterRace(code)}>
        mock result race
      </button>
      <button type="button" onClick={() => onReturnToRoom(code)}>
        mock rematch room
      </button>
      <button type="button" onClick={onReturnToHall}>
        mock result hall
      </button>
    </section>
  )
}));

vi.mock('./TrackEditorClient', () => ({
  TrackEditorClient: ({ onBackToHall }: { onBackToHall(): void }) => (
    <section>
      <span>mock track editor</span>
      <button type="button" onClick={onBackToHall}>
        mock editor hall
      </button>
    </section>
  )
}));

describe('GameShell fixed URL flow', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps the browser on one fixed URL while the online game moves through internal screens', () => {
    window.history.replaceState({}, '', '/');

    render(<GameShell />);

    expect(screen.getByText('mock hall')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'mock enter room' }));
    expect(screen.getByText('mock room 8966')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'mock start race' }));
    expect(screen.getByText('mock race 8966')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'mock finish race' }));
    expect(screen.getByText('mock result 8966')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'mock result hall' }));
    expect(screen.getByText('mock hall')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('opens the track editor as another internal screen instead of navigating away', () => {
    window.history.replaceState({}, '', '/');

    render(<GameShell />);

    fireEvent.click(screen.getByRole('button', { name: 'mock track editor' }));
    expect(screen.getByText('mock track editor')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'mock editor hall' }));
    expect(screen.getByText('mock hall')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('still starts at the hall when the app opens the fixed URL entry without route state', () => {
    window.history.replaceState({}, '', '/');

    render(<GameShell />);

    expect(screen.getByText('mock hall')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
});
