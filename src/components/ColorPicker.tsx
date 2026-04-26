'use client';

import { PLAYER_COLORS, type PlayerColor } from '@/realtime/protocol';

const COLOR_HEX: Record<PlayerColor, string> = {
  yellow: '#f4c430',
  green: '#52c46b',
  purple: '#9b6ef3',
  red: '#ef5350'
};

export function ColorPicker({
  selected,
  taken,
  disabled,
  onSelect
}: {
  selected: PlayerColor | null;
  taken: PlayerColor[];
  disabled?: boolean;
  onSelect(color: PlayerColor): void;
}) {
  return (
    <div className="color-grid" aria-label="Vehicle color">
      {PLAYER_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className="color-swatch"
          aria-label={color}
          aria-pressed={selected === color}
          disabled={disabled || (taken.includes(color) && selected !== color)}
          onClick={() => onSelect(color)}
          style={{ background: COLOR_HEX[color] }}
        />
      ))}
    </div>
  );
}
