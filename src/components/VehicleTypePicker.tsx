'use client';

import React from 'react';
import { DEFAULT_VEHICLE_TYPE, VEHICLE_TYPES, type VehicleType } from '@/realtime/protocol';

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  truck: '卡车',
  motorcycle: '摩托'
};

export function VehicleTypePicker({
  selected,
  disabled,
  compact,
  label,
  onSelect
}: {
  selected: VehicleType | null | undefined;
  disabled?: boolean;
  compact?: boolean;
  label?: string;
  onSelect(vehicleType: VehicleType): void;
}) {
  const current = selected ?? DEFAULT_VEHICLE_TYPE;

  return (
    <div className={compact ? 'vehicle-type-picker-inline' : 'vehicle-type-picker-stack'}>
      {label ? <span className="vehicle-type-picker-label">{label}</span> : null}
      <div className="vehicle-type-segmented" aria-label="车型">
        {VEHICLE_TYPES.map((vehicleType) => (
          <button
            key={vehicleType}
            type="button"
            className={compact ? 'vehicle-type-option vehicle-type-option-compact' : 'vehicle-type-option'}
            aria-pressed={current === vehicleType}
            disabled={disabled}
            onClick={() => onSelect(vehicleType)}
          >
            {VEHICLE_TYPE_LABELS[vehicleType]}
          </button>
        ))}
      </div>
    </div>
  );
}
