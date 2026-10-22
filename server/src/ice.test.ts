import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ice.ts guarda cache em variáveis do módulo, então cada teste importa uma cópia nova.
async function loadIce() {
  vi.resetModules();
  return import("./ice");
}

const CLOUDFLARE_RESPONSE = {
  iceServers: [
    { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"] },
    {
      urls: [
        "turn:turn.cloudflare.com:3478?transport=udp",
        "turn:turn.cloudflare.com:53?transport=udp",
        "turns:turn.cloudflare.com:443?transport=tcp",
      ],
      username: "usuario",
      credential: "senha",
    },
  ],
};

describe("getIceServers", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sem chaves do Cloudflare, usa só STUN e não chama a API", async () => {
    vi.stubEnv("CLOUDFLARE_TURN_KEY_ID", "");
    vi.stubEnv("CLOUDFLARE_TURN_API_TOKEN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { getIceServers } = await loadIce();
    const servers = await getIceServers();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(servers).toHaveLength(1);
    expect(JSON.stringify(servers)).not.toContain("turn:");
  });

  describe("com chaves do Cloudflare", () => {
    beforeEach(() => {
      vi.stubEnv("CLOUDFLARE_TURN_KEY_ID", "minha-chave");
      vi.stubEnv("CLOUDFLARE_TURN_API_TOKEN", "meu-token");
    });

    it("chama a API certa e remove as URLs da porta 53", async () => {
      const fetchMock = vi.fn(async () => new Response(JSON.stringify(CLOUDFLARE_RESPONSE), { status: 201 }));
      vi.stubGlobal("fetch", fetchMock);

      const { getIceServers } = await loadIce();
      const servers = await getIceServers();

      expect(fetchMock).toHaveBeenCalledWith(
        "https://rtc.live.cloudflare.com/v1/turn/keys/minha-chave/credentials/generate-ice-servers",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ Authorization: "Bearer meu-token" }),
        }),
      );
      expect(servers).toEqual([
        { urls: ["stun:stun.cloudflare.com:3478"] },
        {
          urls: ["turn:turn.cloudflare.com:3478?transport=udp", "turns:turn.cloudflare.com:443?transport=tcp"],
          username: "usuario",
          credential: "senha",
        },
      ]);
    });

    it("reaproveita as credenciais (cache) e junta chamadas simultâneas numa só", async () => {
      const fetchMock = vi.fn(async () => new Response(JSON.stringify(CLOUDFLARE_RESPONSE), { status: 201 }));
      vi.stubGlobal("fetch", fetchMock);

      const { getIceServers } = await loadIce();
      await Promise.all([getIceServers(), getIceServers(), getIceServers()]);
      await getIceServers();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("se a API falhar, cai pra STUN e tenta de novo na próxima vez", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response("não autorizado", { status: 401 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(CLOUDFLARE_RESPONSE), { status: 201 }));
      vi.stubGlobal("fetch", fetchMock);

      const { getIceServers } = await loadIce();
      const first = await getIceServers();
      expect(JSON.stringify(first)).not.toContain("turn:");

      const second = await getIceServers();
      expect(JSON.stringify(second)).toContain("turn:turn.cloudflare.com");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
