// Contrato entre cliente e servidor: tudo que trafega pelo Socket.io é tipado aqui,
// assim os dois lados quebram na compilação se alguém mudar uma mensagem.

export const MAX_PARTICIPANTS = 8;
export const NAME_MAX_LENGTH = 24;

// Códigos de sala: 3 a 32 caracteres, letras minúsculas, números e hífen.
const ROOM_ID_PATTERN = /^[a-z0-9-]{3,32}$/;

export function isValidRoomId(roomId: unknown): roomId is string {
  return typeof roomId === "string" && ROOM_ID_PATTERN.test(roomId);
}

/** Remove espaços extras e corta no tamanho máximo. Retorna "" se não sobrar nada. */
export function normalizeName(name: unknown): string {
  if (typeof name !== "string") return "";
  return name.trim().replace(/\s+/g, " ").slice(0, NAME_MAX_LENGTH);
}

export interface Participant {
  id: string;
  name: string;
  joinedAt: number;
  sharing: boolean;
}

export type JoinError = "invalid-room" | "invalid-name" | "room-full";

/** Servidores STUN/TURN no formato que o RTCPeerConnection aceita. */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export type JoinResult =
  | { ok: true; self: Participant; participants: Participant[]; iceServers: IceServer[] }
  | { ok: false; error: JoinError };

// O servidor não tem os tipos do navegador (RTCSessionDescriptionInit etc.),
// então declaramos só o formato que precisa trafegar.
export interface SessionDescription {
  type: "offer" | "answer";
  sdp: string;
}

export interface IceCandidate {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

/**
 * Mensagens de sinalização WebRTC. O servidor só repassa, sem ler o conteúdo.
 *
 * Quem assiste pede ("watch"), quem compartilha oferece ("offer"), quem assiste responde ("answer").
 * Os candidatos ICE são marcados com o lado de quem enviou, porque duas pessoas podem
 * estar compartilhando uma com a outra ao mesmo tempo (duas conexões entre o mesmo par).
 */
export type Signal =
  // quem assiste → quem compartilha
  | { kind: "watch" }
  | { kind: "unwatch" }
  | { kind: "answer"; description: SessionDescription }
  | { kind: "viewer-candidate"; candidate: IceCandidate }
  // quem compartilha → quem assiste
  | { kind: "offer"; description: SessionDescription }
  | { kind: "sharer-candidate"; candidate: IceCandidate };

export const SIGNAL_KINDS: readonly Signal["kind"][] = [
  "watch",
  "unwatch",
  "answer",
  "viewer-candidate",
  "offer",
  "sharer-candidate",
];

/** Eventos que o cliente envia para o servidor. */
export interface ClientToServerEvents {
  "room:join": (payload: { roomId: string; name: string }, ack: (result: JoinResult) => void) => void;
  "room:leave": () => void;
  "share:start": () => void;
  "share:stop": () => void;
  signal: (payload: { to: string; signal: Signal }) => void;
}

/** Eventos que o servidor envia para os clientes. */
export interface ServerToClientEvents {
  "participant:joined": (participant: Participant) => void;
  "participant:left": (payload: { id: string }) => void;
  "participant:updated": (participant: Participant) => void;
  signal: (payload: { from: string; signal: Signal }) => void;
}
