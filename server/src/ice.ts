import type { IceServer } from "@faz-telai/shared";

// Só STUN: resolve a maioria das redes domésticas, mas falha em CGNAT/4G mais restritivos.
const STUN_ONLY: IceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];

// Credenciais valem 12h e são reaproveitadas por 11h, pra ninguém pegar uma prestes a vencer.
const CREDENTIAL_TTL_SECONDS = 12 * 60 * 60;
const CACHE_MS = 11 * 60 * 60 * 1000;

let cache: { servers: IceServer[]; expiresAt: number } | null = null;
let pending: Promise<IceServer[]> | null = null;

/**
 * Lista de servidores ICE entregue a quem entra numa sala.
 * Com as variáveis do Cloudflare configuradas, inclui TURN (retransmissão pra quando
 * a conexão direta falha). Sem elas, ou se a API falhar, cai pra só STUN.
 */
export async function getIceServers(): Promise<IceServer[]> {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (!keyId || !apiToken) return STUN_ONLY;

  if (cache && cache.expiresAt > Date.now()) return cache.servers;

  // Várias pessoas entrando ao mesmo tempo compartilham uma única chamada à API.
  pending ??= fetchCloudflareIceServers(keyId, apiToken)
    .then((servers) => {
      cache = { servers, expiresAt: Date.now() + CACHE_MS };
      return servers;
    })
    .catch((error) => {
      console.error("[turn] não consegui gerar credenciais, usando só STUN:", error);
      return STUN_ONLY;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

async function fetchCloudflareIceServers(keyId: string, apiToken: string): Promise<IceServer[]> {
  const response = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: CREDENTIAL_TTL_SECONDS }),
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!response.ok) throw new Error(`Cloudflare respondeu ${response.status}`);

  const { iceServers } = (await response.json()) as { iceServers: IceServer[] };
  // A porta 53 é bloqueada pelos navegadores e só atrasaria a conexão.
  return iceServers.map((server) => ({
    ...server,
    urls: (Array.isArray(server.urls) ? server.urls : [server.urls]).filter((url) => !/:53(\?|$)/.test(url)),
  }));
}
