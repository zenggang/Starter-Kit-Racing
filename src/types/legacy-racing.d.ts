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
  }

  export function mountRacingRuntime(
    container: HTMLElement,
    options?: MountRacingRuntimeOptions
  ): Promise<RacingRuntimeHandle>;
}
