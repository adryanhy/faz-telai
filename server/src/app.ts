import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import express from "express";
import { Server, type Socket } from "socket.io";
import {
  isValidRoomId,
  normalizeName,
  SIGNAL_KINDS,
  type ClientToServerEvents,
  type IceServer,
  type ServerToClientEvents,
  type Signal,
} from "@faz-telai/shared";
import { getIceServers } from "./ice.js";
import { RoomStore } from "./rooms.js";

interface SocketData {
  roomId?: string;
}

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export interface AppOptions {
  /** Pasta do site buildado. Se existir, o servidor também entrega o site (produção). */
  clientDist?: string;
  /** Troca a fonte de servidores STUN/TURN (os testes usam isso pra não chamar o Cloudflare). */
  iceServers?: () => Promise<IceServer[]>;
}

// Uma descrição SDP de tela + áudio tem poucos KB; 64 KB é folga de sobra.
const MAX_SIGNAL_SIZE = 64 * 1024;

function isValidSignal(signal: unknown): signal is Signal {
  if (typeof signal !== "object" || signal === null) return false;
  if (!SIGNAL_KINDS.includes((signal as Signal).kind)) return false;
  return JSON.stringify(signal).length <= MAX_SIGNAL_SIZE;
}

/**
 * Monta o servidor HTTP + Socket.io sem começar a escutar,
 * pra que o index.ts suba na porta certa e os testes subam numa porta qualquer.
 */
export function createAppServer({ clientDist, iceServers = getIceServers }: AppOptions = {}) {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer);
  const rooms = new RoomStore();

  app.get("/health", (_req, res) => {
    res.json({ ok: true, ...rooms.stats() });
  });

  // Em produção o próprio servidor entrega o site já buildado.
  // Em desenvolvimento quem serve o site é o Vite (porta 5173).
  if (clientDist && existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // Qualquer outra rota (ex.: /sala/abc) cai no index.html e o React Router resolve.
    app.use((req, res, next) => {
      if (req.method !== "GET") return next();
      res.sendFile(join(clientDist, "index.html"));
    });
  }

  function leaveCurrentRoom(socket: AppSocket) {
    const { roomId } = socket.data;
    if (!roomId) return;

    socket.data.roomId = undefined;
    socket.leave(roomId);
    if (rooms.leave(roomId, socket.id)) {
      socket.to(roomId).emit("participant:left", { id: socket.id });
    }
  }

  function setSharing(socket: AppSocket, sharing: boolean) {
    const { roomId } = socket.data;
    if (!roomId) return;

    const participant = rooms.setSharing(roomId, socket.id, sharing);
    if (participant) io.to(roomId).emit("participant:updated", participant);
  }

  io.on("connection", (socket: AppSocket) => {
    socket.on("room:join", async (payload, ack) => {
      if (typeof ack !== "function") return;

      const roomId = payload?.roomId;
      const name = normalizeName(payload?.name);
      if (!isValidRoomId(roomId)) return ack({ ok: false, error: "invalid-room" });
      if (!name) return ack({ ok: false, error: "invalid-name" });

      // As credenciais TURN só vão pra quem entra numa sala, nunca numa rota pública.
      const servers = await iceServers();
      if (socket.disconnected) return;

      // Entrar numa sala nova significa sair da anterior.
      leaveCurrentRoom(socket);

      const self = { id: socket.id, name, joinedAt: Date.now(), sharing: false };
      const others = rooms.join(roomId, self);
      if (others === "room-full") return ack({ ok: false, error: "room-full" });

      socket.data.roomId = roomId;
      socket.join(roomId);
      socket.to(roomId).emit("participant:joined", self);
      ack({ ok: true, self, participants: [...others, self], iceServers: servers });
    });

    socket.on("room:leave", () => leaveCurrentRoom(socket));
    socket.on("disconnect", () => leaveCurrentRoom(socket));

    socket.on("share:start", () => setSharing(socket, true));
    socket.on("share:stop", () => setSharing(socket, false));

    // O servidor é só o "carteiro" da sinalização: confere se o destinatário está
    // na mesma sala e repassa a mensagem carimbando quem mandou.
    socket.on("signal", (payload) => {
      const { roomId } = socket.data;
      const to = payload?.to;
      const signal = payload?.signal;
      if (!roomId || typeof to !== "string" || to === socket.id) return;
      if (!isValidSignal(signal) || !rooms.has(roomId, to)) return;

      io.to(to).emit("signal", { from: socket.id, signal });
    });
  });

  return { app, httpServer, io, rooms };
}
