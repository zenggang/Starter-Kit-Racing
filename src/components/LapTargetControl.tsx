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
      <button type="button" className="step-button" disabled={disabled || value <= 1} onClick={() => onChange(value - 1)} aria-label="减少圈数">
        -
      </button>
      <strong className="lap-readout">{value} 圈</strong>
      <button type="button" className="step-button" disabled={disabled || value >= 10} onClick={() => onChange(value + 1)} aria-label="增加圈数">
        +
      </button>
    </div>
  );
}
