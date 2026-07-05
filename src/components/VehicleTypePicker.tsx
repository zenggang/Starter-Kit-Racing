'use client';

import React from 'react';
import {
  DEFAULT_VEHICLE_MODEL,
  DEFAULT_VEHICLE_TYPE,
  VEHICLE_MODELS,
  VEHICLE_TYPES,
  type VehicleModel,
  type VehicleType
} from '@/realtime/protocol';

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  truck: '卡车',
  car: '轿车',
  motorcycle: '摩托',
  dog: '狗狗'
};

export const VEHICLE_MODEL_LABELS: Record<VehicleModel, string> = {
  'mercedes-e': '奔驰E级'
};

export function formatVehicleSelectionLabel(vehicleType: VehicleType | null | undefined, vehicleModel?: VehicleModel | null): string {
  const currentType = vehicleType ?? DEFAULT_VEHICLE_TYPE;
  if (currentType !== 'car') {
    return VEHICLE_TYPE_LABELS[currentType];
  }

  const currentModel = vehicleModel ?? DEFAULT_VEHICLE_MODEL;
  return `${VEHICLE_TYPE_LABELS.car} · ${VEHICLE_MODEL_LABELS[currentModel]}`;
}

export function VehicleTypePicker({
  selected,
  selectedModel,
  disabled,
  compact,
  label,
  onSelect
}: {
  selected: VehicleType | null | undefined;
  selectedModel?: VehicleModel | null;
  disabled?: boolean;
  compact?: boolean;
  label?: string;
  onSelect(selection: { vehicleType: VehicleType; vehicleModel: VehicleModel | null }): void;
}) {
  const current = selected ?? DEFAULT_VEHICLE_TYPE;
  const currentModel = selectedModel ?? DEFAULT_VEHICLE_MODEL;
  const optionClassName = compact ? 'vehicle-type-option vehicle-type-option-compact' : 'vehicle-type-option';

  return (
    <div className={compact ? 'vehicle-type-picker-inline' : 'vehicle-type-picker-stack'}>
      {label ? <span className="vehicle-type-picker-label">{label}</span> : null}
      <div className="vehicle-type-segmented" aria-label="车辆品类">
        {VEHICLE_TYPES.map((vehicleType) => (
          <button
            key={vehicleType}
            type="button"
            className={optionClassName}
            aria-pressed={current === vehicleType}
            disabled={disabled}
            onClick={() => onSelect({ vehicleType, vehicleModel: vehicleType === 'car' ? currentModel : null })}
          >
            {VEHICLE_TYPE_LABELS[vehicleType]}
          </button>
        ))}
      </div>
      {current === 'car' ? (
        <>
          <span className="vehicle-type-picker-label">车型</span>
          <div className="vehicle-type-segmented vehicle-model-segmented" aria-label="车型">
            {VEHICLE_MODELS.map((vehicleModel) => (
              <button
                key={vehicleModel}
                type="button"
                className={optionClassName}
                aria-pressed={currentModel === vehicleModel}
                disabled={disabled}
                onClick={() => onSelect({ vehicleType: 'car', vehicleModel })}
              >
                {VEHICLE_MODEL_LABELS[vehicleModel]}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
