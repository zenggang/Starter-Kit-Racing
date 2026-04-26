declare module '../../js/main.js' {
  export function mountRacingRuntime(
    container: HTMLElement,
    options?: Record<string, unknown>
  ): Promise<{
    destroy(): void;
  }>;
}
