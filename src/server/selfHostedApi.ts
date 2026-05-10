import { getSelfHostedServerBaseUrl } from '@/config/env';

export async function forwardSelfHostedRequest(path: string, init?: RequestInit): Promise<Response> {
  const baseUrl = getSelfHostedServerBaseUrl();
  const url = `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  return fetch(url, init);
}
