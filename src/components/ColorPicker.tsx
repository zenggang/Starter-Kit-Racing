'use client';

import { PLAYER_COLORS, type PlayerColor } from '@/realtime/protocol';

export const PLAYER_COLOR_HEX: Record<PlayerColor, string> = {
  yellow: '#f4c430',
  green: '#52c46b',
  purple: '#9b6ef3',
  red: '#ef5350'
};

export const PLAYER_COLOR_LABELS: Record<PlayerColor, string> = {
  yellow: '黄色赛车',
  green: '绿色赛车',
  purple: '紫色赛车',
  red: '红色赛车'
};

export function ColorPicker({
  selected,
  taken,
  disabled,
  compact,
  label,
  onSelect
}: {
  selected: PlayerColor | null;
  taken: PlayerColor[];
  disabled?: boolean;
  compact?: boolean;
  label?: string;
  onSelect(color: PlayerColor): void;
}) {
  const gridClassName = compact ? 'color-grid color-grid-compact' : 'color-grid';
  const currentLabel = selected ? PLAYER_COLOR_LABELS[selected] : null;

  return (
    <div className={compact ? 'color-picker-inline' : 'color-picker-stack'}>
      {label ? (
        <span className="color-picker-label">
          {label}
          {compact && currentLabel ? <strong className="color-picker-current">已选</strong> : null}
        </span>
      ) : null}
      <div className={gridClassName} aria-label="赛车颜色">
        {PLAYER_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={compact ? 'color-swatch color-swatch-compact' : 'color-swatch'}
            aria-label={PLAYER_COLOR_LABELS[color]}
            aria-pressed={selected === color}
            data-selected={selected === color ? 'true' : 'false'}
            disabled={disabled || (taken.includes(color) && selected !== color)}
            onClick={() => onSelect(color)}
            style={{ background: PLAYER_COLOR_HEX[color] }}
          >
            {compact ? <span className="sr-only">{PLAYER_COLOR_LABELS[color]}</span> : <span>{PLAYER_COLOR_LABELS[color]}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
