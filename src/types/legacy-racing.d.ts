declare module '../../js/main.js' {
  export interface RacingRuntimeSnapshot {
    position: {
      x: number;
      y: number;
      z: number;
    };
    heading: number;
    speed: number;
    driftIntensity: number;
  }

  export interface RacingRemoteVehicleTelemetry {
    playerId: string;
    nickname: string;
    color: 'yellow' | 'green' | 'purple' | 'red';
    presence: 'pending' | 'connected' | 'disconnected' | 'finished';
    position: {
      x: number;
      y: number;
      z: number;
    };
    heading: number;
    speed: number;
    lastReportAt: string | null;
  }

  export interface MountRacingRuntimeOptions {
    assetBaseUrl?: string;
    roomCode?: string;
    map?: string | null;
    trackMap?: string | null;
    useQueryMap?: boolean;
    vehicleColor?: 'yellow' | 'green' | 'purple' | 'red';
  }

  export interface RacingRuntimeHandle {
    destroy(): void;
    getSnapshot(): RacingRuntimeSnapshot;
    updateRemoteVehicles(vehicles: RacingRemoteVehicleTelemetry[]): void;
  }

  export function mountRacingRuntime(
    container: HTMLElement,
    options?: MountRacingRuntimeOptions
  ): Promise<RacingRuntimeHandle>;
}

declare module '../../js/TrackEditorRuntime.js' {
  export type TrackEditorTool = 'road' | 'erase';

  export interface TrackEditorChange {
    trackMap: string;
    cells: readonly (readonly [number, number, string, number])[];
    cellCount: number;
  }

  export interface MountTrackEditorRuntimeOptions {
    assetBaseUrl?: string;
    storageKey?: string;
    initialTool?: TrackEditorTool;
    initialTrackMap?: string | null;
    onChange?(change: TrackEditorChange): void;
  }

  export interface TrackEditorRuntimeHandle {
    destroy(): void;
    setTool(tool: TrackEditorTool): void;
    clear(): void;
    setTrackMap(trackMap: string | null): void;
    getTrackMap(): string | null;
    getCells(): readonly (readonly [number, number, string, number])[];
    getCellCount(): number;
  }

  export function mountTrackEditorRuntime(
    container: HTMLElement,
    options?: MountTrackEditorRuntimeOptions
  ): Promise<TrackEditorRuntimeHandle>;
}
