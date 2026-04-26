'use client';

export function LapTargetControl({
  value,
  disabled,
  onChange
}: {
  value: number;
  disabled?: boolean;
  onChange(value: number): void;
}) {
  return (
    <div className="row row-wrap">
      <button type="button" disabled={disabled || value <= 1} onClick={() => onChange(value - 1)} aria-label="Decrease lap target">
        -
      </button>
      <strong>{value} laps</strong>
      <button type="button" disabled={disabled || value >= 10} onClick={() => onChange(value + 1)} aria-label="Increase lap target">
        +
      </button>
    </div>
  );
}
