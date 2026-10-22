import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, JoinError, Participant, ServerToClientEvents } from "@faz-telai/shared";
import type { ShareSettings } from "../lib/quality";
import { ScreenShare, type ShareSnapshot } from "../lib/ScreenShare";
import { loadSettings, saveSettings } from "../lib/storage";

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type RoomStatus =
  | { kind: "connecting" }
  | { kind: "joined" }
  | { kind: "reconnecting" }
  | { kind: "error"; error: JoinError };

export interface RoomState {
  status: RoomStatus;
  selfId: string | null;
  participants: Participant[];
  share: ShareSnapshot;
}

export interface RoomActions {
  settings: ShareSettings;
  startSharing: () => Promise<void>;
  stopSharing: () => void;
  /** Salva a escolha e, se já estiver compartilhando, aplica na hora. */
  changeSettings: (patch: Partial<ShareSettings>) => void;
  watch: (sharerId: string) => void;
  unwatch: (sharerId: string) => void;
}

const EMPTY_SHARE: ShareSnapshot = { localStream: null, localAudioMissing: false, viewerIds: [], watching: {} };
const INITIAL_STATE: RoomState = { status: { kind: "connecting" }, selfId: null, participants: [], share: EMPTY_SHARE };

/**
 * Conecta no servidor, entra na sala e mantém participantes e transmissões atualizados.
 * Cada montagem cria seu próprio socket e o desmontar fecha a conexão.
 */
export function useRoom(roomId: string, name: string | null): RoomState & RoomActions {
  const [state, setState] = useState<RoomState>(INITIAL_STATE);
  const shareRef = useRef<ScreenShare | null>(null);
  const [settings, setSettings] = useState<ShareSettings>(loadSettings);
  // Ref espelhando o estado, pra que as ações não precisem ser recriadas a cada mudança.
  const settingsRef = useRef(settings);

  useEffect(() => {
    if (!name) return;

    setState(INITIAL_STATE);
    const socket: AppSocket = io();
    const share = new ScreenShare(socket, (snapshot) => setState((s) => ({ ...s, share: snapshot })));
    shareRef.current = share;

    // Roda na primeira conexão e em toda reconexão: o socket ganha um id novo
    // e o servidor já esqueceu da gente, então é preciso entrar de novo.
    socket.on("connect", () => {
      socket.emit("room:join", { roomId, name }, (result) => {
        if (!result.ok) {
          setState((s) => ({ ...s, status: { kind: "error", error: result.error } }));
          share.destroy();
          socket.disconnect();
          return;
        }
        setState((s) => ({
          ...s,
          status: { kind: "joined" },
          selfId: result.self.id,
          participants: result.participants,
        }));
        share.handleRejoined(result.iceServers);
      });
    });

    socket.on("disconnect", (reason) => {
      // "io client disconnect" = nós mesmos fechamos (sala cheia ou saída da página).
      if (reason === "io client disconnect") return;
      share.handleDisconnected();
      setState((s) => ({ ...s, status: { kind: "reconnecting" } }));
    });

    socket.on("participant:joined", (participant) => {
      setState((s) => ({
        ...s,
        participants: [...s.participants.filter((p) => p.id !== participant.id), participant],
      }));
    });

    socket.on("participant:updated", (participant) => {
      setState((s) => ({
        ...s,
        participants: s.participants.map((p) => (p.id === participant.id ? participant : p)),
      }));
      share.handleParticipantUpdated(participant);
    });

    socket.on("participant:left", ({ id }) => {
      setState((s) => ({ ...s, participants: s.participants.filter((p) => p.id !== id) }));
      share.handleParticipantLeft(id);
    });

    return () => {
      share.destroy();
      shareRef.current = null;
      socket.disconnect();
    };
  }, [roomId, name]);

  const startSharing = useCallback(async () => {
    await shareRef.current?.startSharing(settingsRef.current);
  }, []);
  const changeSettings = useCallback((patch: Partial<ShareSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    saveSettings(next);
    shareRef.current?.updateSettings(next).catch((error) => console.warn("[qualidade]", error));
  }, []);
  const stopSharing = useCallback(() => shareRef.current?.stopSharing(), []);
  const watch = useCallback((sharerId: string) => shareRef.current?.watch(sharerId), []);
  const unwatch = useCallback((sharerId: string) => shareRef.current?.unwatch(sharerId), []);

  return { ...state, settings, startSharing, stopSharing, changeSettings, watch, unwatch };
}
