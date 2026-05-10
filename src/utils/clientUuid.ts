/**
 * HTTP + IP 临时入口不是安全上下文，部分浏览器会暴露 `crypto` 但不提供
 * `randomUUID()`。这里优先走原生 UUID，缺失时退回到 `getRandomValues()`
 * 生成 RFC4122 v4 形态的标识，保证首页、房间指令和比赛指令都能继续工作。
 */
export function createClientUuid(): string {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));

    // UUID v4 需要固定 version / variant 位，避免后续日志和调试工具把它识别成脏值。
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // 极端兜底只要求“本地唯一”，用于无安全上下文的浏览器继续拿到稳定 session。
  return `fallback-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`;
}
