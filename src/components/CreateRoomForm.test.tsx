import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateRoomForm } from './CreateRoomForm';

describe('CreateRoomForm scene selection', () => {
  it('lets the host choose forest or city before creating a room', () => {
    const onSelectScene = vi.fn();
    const onCreate = vi.fn();

    render(
      <CreateRoomForm
        player={{ playerId: 'player-1', nickname: 'Racer', lastRoomCode: null }}
        tracks={[]}
        selectedTrackId={null}
        selectedTrackScene="forest"
        onSelectTrack={vi.fn()}
        onSelectScene={onSelectScene}
        onCreate={onCreate}
      />
    );

    const scenePicker = screen.getByLabelText('比赛场景');
    expect(scenePicker).toHaveValue('forest');

    fireEvent.change(scenePicker, { target: { value: 'city' } });
    expect(onSelectScene).toHaveBeenCalledWith('city');

    fireEvent.click(screen.getByRole('button', { name: '创建房间' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
