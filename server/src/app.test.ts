import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import {
  MAX_PARTICIPANTS,
  type ClientToServerEvents,
  type JoinResult,
  type ServerToClientEvents,
} from "@faz-telai/shared";
import { createAppServer } from "./app";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const TEST_ICE = [{ urls: "stun:teste.local:3478" }];

let server: ReturnType<typeof createAppServer>;
let baseUrl: string;
const clients: Client[] = [];

async function startServer(clientDist?: string) {
  server = createAppServer({ clientDist, iceServers: async () => TEST_ICE });
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  baseUrl = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
}

function newClient(): Promise<Client> {
  const client: Client = connect(baseUrl, { forceNew: true, transports: ["websocket"] });
  clients.push(client);
  return new Promise((resolve) => client.on("connect", () => resolve(client)));
}

function joinRoom(client: Client, roomId: string, name: string): Promise<JoinResult> {
  return new Promise((resolve) => client.emit("room:join", { roomId, name }, resolve));
}

async function joined(roomId: string, name: string) {
  const client = await newClient();
  const result = await joinRoom(client, roomId, name);
  if (!result.ok) throw new Error(`não entrou: ${result.error}`);
  return { client, self: result.self };
}

/** Espera um evento chegar (falha depois de 1s). */
function next<E extends keyof ServerToClientEvents>(client: Client, event: E) {
  return new Promise<Parameters<ServerToClientEvents[E]>[0]>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`"${event}" não chegou`)), 1000);
    client.once(event, ((payload: Parameters<ServerToClientEvents[E]>[0]) => {
      clearTimeout(timer);
      resolve(payload);
    }) as never);
  });
}

/** Garante que um evento NÃO chega dentro de um tempo. */
async function nothing(client: Client, event: keyof ServerToClientEvents, ms = 150) {
  let received = false;
  const handler = () => (received = true);
  client.on(event, handler);
  await new Promise((r) => setTimeout(r, ms));
  client.off(event, handler);
  expect(received, `"${event}" não deveria ter chegado`).toBe(false);
}

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await new Promise<void>((resolve) => server.io.close(() => resolve()));
});

describe("salas", () => {
  beforeEach(() => startServer());

  it("entra na sala e recebe a si mesmo, a lista e os servidores ICE", async () => {
    const client = await newClient();
    const result = await joinRoom(client, "sala-teste", "  Bia  ");

    expect(result).toMatchObject({
      ok: true,
      self: { id: client.id, name: "Bia", sharing: false },
      iceServers: TEST_ICE,
    });
    expect(result.ok && result.participants.map((p) => p.name)).toEqual(["Bia"]);
  });

  it("recusa código de sala e apelido inválidos", async () => {
    const client = await newClient();
    expect(await joinRoom(client, "SALA INVÁLIDA", "Bia")).toEqual({ ok: false, error: "invalid-room" });
    expect(await joinRoom(client, "sala-teste", "    ")).toEqual({ ok: false, error: "invalid-name" });
  });

  it("avisa quem está na sala quando alguém entra e quando sai", async () => {
    const { client: bia } = await joined("sala-teste", "Bia");

    const joinedEvent = next(bia, "participant:joined");
    const { client: caio, self: caioSelf } = await joined("sala-teste", "Caio");
    expect(await joinedEvent).toEqual(caioSelf);

    const leftEvent = next(bia, "participant:left");
    caio.disconnect();
    expect(await leftEvent).toEqual({ id: caioSelf.id });
  });

  it(`recusa a pessoa número ${MAX_PARTICIPANTS + 1}`, async () => {
    for (let i = 0; i < MAX_PARTICIPANTS; i++) await joined("sala-cheia", `p${i}`);
    const extra = await newClient();
    expect(await joinRoom(extra, "sala-cheia", "extra")).toEqual({ ok: false, error: "room-full" });
  });

  it("trocar de sala tira a pessoa da sala anterior", async () => {
    const { client: bia } = await joined("sala-1", "Bia");
    const { client: caio, self: caioSelf } = await joined("sala-1", "Caio");

    const leftEvent = next(bia, "participant:left");
    await joinRoom(caio, "sala-2", "Caio");
    expect(await leftEvent).toEqual({ id: caioSelf.id });
  });

  it("/health mostra quantas salas e pessoas existem", async () => {
    await joined("sala-1", "Bia");
    await joined("sala-1", "Caio");
    await joined("sala-2", "Duda");

    const health = await fetch(`${baseUrl}/health`).then((r) => r.json());
    expect(health).toEqual({ ok: true, rooms: 2, participants: 3 });
  });
});

describe("compartilhamento", () => {
  beforeEach(() => startServer());

  it("share:start e share:stop avisam a sala inteira, inclusive quem compartilha", async () => {
    const { client: bia, self } = await joined("sala-teste", "Bia");
    const { client: caio } = await joined("sala-teste", "Caio");

    const forCaio = next(caio, "participant:updated");
    const forBia = next(bia, "participant:updated");
    bia.emit("share:start");
    expect(await forCaio).toEqual({ ...self, sharing: true });
    expect(await forBia).toEqual({ ...self, sharing: true });

    const stopped = next(caio, "participant:updated");
    bia.emit("share:stop");
    expect(await stopped).toMatchObject({ id: self.id, sharing: false });
  });

  it("quem entra depois já vê quem está compartilhando", async () => {
    const { client: bia } = await joined("sala-teste", "Bia");
    bia.emit("share:start");
    await next(bia, "participant:updated");

    const caio = await newClient();
    const result = await joinRoom(caio, "sala-teste", "Caio");
    expect(result.ok && result.participants.find((p) => p.name === "Bia")?.sharing).toBe(true);
  });
});

describe("sinalização", () => {
  beforeEach(() => startServer());

  it("repassa o sinal pro destinatário, carimbando quem mandou", async () => {
    const { client: bia, self: biaSelf } = await joined("sala-teste", "Bia");
    const { client: caio, self: caioSelf } = await joined("sala-teste", "Caio");

    const received = next(bia, "signal");
    caio.emit("signal", { to: biaSelf.id, signal: { kind: "watch" } });
    expect(await received).toEqual({ from: caioSelf.id, signal: { kind: "watch" } });
  });

  it("não repassa pra quem está em outra sala", async () => {
    const { client: bia, self: biaSelf } = await joined("sala-1", "Bia");
    const { client: intruso } = await joined("sala-2", "Intruso");

    intruso.emit("signal", { to: biaSelf.id, signal: { kind: "watch" } });
    await nothing(bia, "signal");
  });

  it("descarta sinais de tipo desconhecido ou grandes demais", async () => {
    const { client: bia, self: biaSelf } = await joined("sala-teste", "Bia");
    const { client: caio } = await joined("sala-teste", "Caio");

    caio.emit("signal", { to: biaSelf.id, signal: { kind: "hack" } as never });
    caio.emit("signal", {
      to: biaSelf.id,
      signal: { kind: "offer", description: { type: "offer", sdp: "x".repeat(70 * 1024) } },
    });
    await nothing(bia, "signal");
  });

  it("ignora sinais de quem não entrou em nenhuma sala", async () => {
    const { client: bia, self: biaSelf } = await joined("sala-teste", "Bia");
    const semSala = await newClient();

    semSala.emit("signal", { to: biaSelf.id, signal: { kind: "watch" } });
    await nothing(bia, "signal");
  });
});

describe("site em produção", () => {
  let dist: string;

  beforeEach(async () => {
    dist = mkdtempSync(join(tmpdir(), "faz-telai-dist-"));
    writeFileSync(join(dist, "index.html"), "<!doctype html><title>Faz telai</title>");
    await startServer(dist);
  });

  afterEach(() => rmSync(dist, { recursive: true, force: true }));

  it("entrega o index.html em qualquer rota do app (ex.: link de sala)", async () => {
    for (const path of ["/", "/sala/capivara-turbo-k7q2"]) {
      const response = await fetch(`${baseUrl}${path}`);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("<title>Faz telai</title>");
    }
  });
});
