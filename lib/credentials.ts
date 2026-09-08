import { getConfig } from './request';

export interface ConnectionToken {
  accessToken: string;
  provider: string;
  credentialId: string;
  alias: string;
}

export class ConnectionError extends Error {
  constructor(
    message: string,
    /** 'not_granted' → the app has no grant under this alias; 'reauth_required' → the owner must reconnect. */
    public readonly code: 'not_granted' | 'reauth_required' | 'unknown',
    public readonly alias: string
  ) {
    super(message);
    this.name = 'ConnectionError';
  }
}

/**
 * Get a valid access token for a connection granted to this app, e.g.
 * `const { accessToken } = await getConnectionToken('GOOGLE_SHEET')`.
 *
 * Server-side only. Call it per request and never cache the token: Teable refreshes the
 * underlying OAuth credential for you and tokens expire. A `reauth_required` error means
 * the connection's owner has to reconnect it in Settings › Integrations — the grant itself
 * stays valid; do not ask for a new grant.
 */
export async function getConnectionToken(alias: string): Promise<ConnectionToken> {
  const { baseUrl, token, appId } = getConfig();
  const response = await fetch(
    `${baseUrl}/api/credential/resource/app/${appId}/connection-token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ alias }),
      cache: 'no-store',
    }
  );
  if (response.ok) return (await response.json()) as ConnectionToken;
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    data?: { code?: string };
  };
  const code =
    response.status === 404
      ? 'not_granted'
      : body.data?.code === 'CONNECTION_REAUTH_REQUIRED'
        ? 'reauth_required'
        : 'unknown';
  throw new ConnectionError(body.message ?? `Connection ${alias}: HTTP ${response.status}`, code, alias);
}
