import type { Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  IceCandidate,
  Participant,
  IceServer,
  ServerToClientEvents,
  SessionDescription,
  Signal,
} from "@faz-telai/shared";
import {
  applySenderProfile,
  captureConstraints,
  DISPLAY_AUDIO_CONSTRAINTS,
  DEFAULT_SETTINGS,
  getProfile,
  type QualityProfile,
  type ShareSettings,
} from "./quality";
import { FALLBACK_ICE_SERVERS, Peer } from "./webrtc";

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type WatchStatus =
  | "connecting" // pedimos pra assistir e a conexão está sendo montada
  | "live" // vídeo chegando
  | "paused" // a pessoa parou de compartilhar; voltamos sozinhos se ela recomeçar
  | "failed"; // a conexão não fechou (rede bloqueando, por exemplo)

export interface WatchState {
  status: WatchStatus;
  stream: MediaStream | null;
}

export interface ShareSnapshot {
  localStream: MediaStream | null;
  /** Pedimos áudio, mas o navegador entregou só vídeo. */
  localAudioMissing: boolean;
  /** Ids de quem está assistindo a nossa tela. */
  viewerIds: string[];
  /** Telas que estamos assistindo, por id de quem compartilha. */
  watching: Record<string, WatchState>;
}

/**
 * Toda a parte WebRTC da sala, sem nada de React.
 *
 * Cada transmissão é uma conexão P2P de mão única: quem compartilha tem uma conexão
 * de saída para cada pessoa assistindo (`outgoing`), e quem assiste tem uma conexão
 * de entrada para cada tela que está vendo (`incoming`). Nada é aberto até alguém
 * clicar em "Assistir", então quem compartilha só gasta upload com quem está vendo.
 */
export class ScreenShare {
  private localStream: MediaStream | null = null;
  private audioMissing = false;
  private profile: QualityProfile = getProfile(DEFAULT_SETTINGS);
  private iceServers: IceServer[] = FALLBACK_ICE_SERVERS;
  private outgoing = new Map<string, Peer>();
  private incoming = new Map<string, Peer>();
  private watching = new Map<string, WatchState>();

  constructor(
    private readonly socket: AppSocket,
    private readonly onChange: (snapshot: ShareSnapshot) => void,
  ) {
    socket.on("signal", ({ from, signal }) => {
      this.handleSignal(from, signal).catch((error) => console.warn("[sinalização]", signal.kind, error));
    });
  }

  // ---------- Compartilhar ----------

  get isSharing() {
    return this.localStream !== null;
  }

  /** Abre o seletor do navegador. Lança erro se a pessoa cancelar. */
  async startSharing(settings: ShareSettings) {
    if (this.localStream) return;

    this.profile = getProfile(settings);
    // Campos que só o Chrome/Edge entendem ficam fora dos tipos padrão do DOM.
    const options: DisplayMediaStreamOptions & Record<string, unknown> = {
      video: captureConstraints(this.profile),
      audio: settings.audio ? DISPLAY_AUDIO_CONSTRAINTS : false,
      selfBrowserSurface: "exclude", // não deixa compartilhar a própria aba (efeito espelho infinito)
      systemAudio: settings.audio ? "include" : "exclude",
    };
    const stream = await navigator.mediaDevices.getDisplayMedia(options);

    // Pedir áudio não garante receber: janela no Windows, Firefox e Mac costumam vir só com vídeo,
    // e o navegador não avisa. Guardamos isso pra interface alertar quem está compartilhando.
    this.audioMissing = settings.audio && stream.getAudioTracks().length === 0;

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.contentHint = this.profile.contentHint;
      // Botão "Parar de compartilhar" nativo do navegador.
      videoTrack.addEventListener("ended", () => this.stopSharing());
    }

    this.localStream = stream;
    this.socket.emit("share:start");
    this.notify();
  }

  /** Troca modo/resolução no meio da transmissão, sem derrubar ninguém. */
  async updateSettings(settings: ShareSettings) {
    this.profile = getProfile(settings);
    const videoTrack = this.localStream?.getVideoTracks()[0];
    if (!videoTrack) return;

    videoTrack.contentHint = this.profile.contentHint;
    await videoTrack.applyConstraints(captureConstraints(this.profile));
    await Promise.all(
      [...this.outgoing.values()].map((peer) => {
        const sender = peer.pc.getSenders().find((s) => s.track?.kind === "video");
        return sender && applySenderProfile(sender, this.profile);
      }),
    );
  }

  stopSharing() {
    if (!this.localStream) return;

    for (const track of this.localStream.getTracks()) track.stop();
    this.localStream = null;
    this.audioMissing = false;
    for (const viewerId of [...this.outgoing.keys()]) this.closeOutgoing(viewerId);
    this.socket.emit("share:stop");
    this.notify();
  }

  // ---------- Assistir ----------

  watch(sharerId: string) {
    this.closeIncoming(sharerId);
    this.watching.set(sharerId, { status: "connecting", stream: null });
    this.send(sharerId, { kind: "watch" });
    this.notify();
  }

  unwatch(sharerId: string) {
    if (!this.watching.delete(sharerId)) return;
    this.closeIncoming(sharerId);
    this.send(sharerId, { kind: "unwatch" });
    this.notify();
  }

  // ---------- Eventos da sala (chamados pelo hook) ----------

  handleParticipantUpdated(participant: Participant) {
    const watch = this.watching.get(participant.id);
    if (!watch) return;

    if (participant.sharing && watch.status === "paused") {
      this.watch(participant.id);
    } else if (!participant.sharing) {
      this.closeIncoming(participant.id);
      this.watching.set(participant.id, { status: "paused", stream: null });
      this.notify();
    }
  }

  handleParticipantLeft(id: string) {
    this.closeOutgoing(id);
    this.closeIncoming(id);
    this.watching.delete(id);
    this.notify();
  }

  /** A conexão com o servidor caiu: todas as conexões P2P viraram lixo (nosso id vai mudar). */
  handleDisconnected() {
    for (const id of [...this.outgoing.keys()]) this.closeOutgoing(id);
    for (const id of [...this.incoming.keys()]) this.closeIncoming(id);
    this.watching.clear();
    this.notify();
  }

  /**
   * Entramos (ou voltamos) na sala: guarda os servidores STUN/TURN enviados pelo servidor
   * e, se estávamos compartilhando, avisa de novo (nosso id mudou).
   */
  handleRejoined(iceServers: IceServer[]) {
    this.iceServers = iceServers.length > 0 ? iceServers : FALLBACK_ICE_SERVERS;
    if (this.localStream) this.socket.emit("share:start");
  }

  destroy() {
    this.handleDisconnected();
    if (this.localStream) for (const track of this.localStream.getTracks()) track.stop();
    this.localStream = null;
    this.socket.off("signal");
  }

  // ---------- Sinalização ----------

  private async handleSignal(from: string, signal: Signal) {
    switch (signal.kind) {
      // Alguém quer assistir a nossa tela.
      case "watch":
        return this.openOutgoing(from);
      case "unwatch":
        return this.closeOutgoing(from);
      case "answer":
        return this.outgoing.get(from)?.setRemoteDescription(signal.description);
      case "viewer-candidate":
        return this.outgoing.get(from)?.addIceCandidate(signal.candidate);

      // Quem compartilha está montando a conexão com a gente.
      case "offer":
        return this.acceptOffer(from, signal.description);
      case "sharer-candidate":
        return this.incoming.get(from)?.addIceCandidate(signal.candidate);
    }
  }

  private async openOutgoing(viewerId: string) {
    const stream = this.localStream;
    if (!stream) return;

    this.closeOutgoing(viewerId);
    const peer = new Peer(this.iceServers);
    this.outgoing.set(viewerId, peer);
    this.notify();

    const profile = this.profile;
    let videoSender: RTCRtpSender | undefined;
    for (const track of stream.getTracks()) {
      if (track.kind !== "video") {
        peer.pc.addTrack(track, stream);
        continue;
      }
      // O teto de bitrate já vai na negociação; sem ele o navegador começa bem conservador.
      videoSender = peer.pc.addTransceiver(track, {
        direction: "sendonly",
        streams: [stream],
        sendEncodings: [{ maxBitrate: profile.maxBitrate, maxFramerate: profile.frameRate }],
      }).sender;
    }

    peer.pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.send(viewerId, { kind: "sharer-candidate", candidate: toIceCandidate(candidate) });
    };
    peer.pc.onconnectionstatechange = () => {
      if (peer.pc.connectionState === "failed" && this.outgoing.get(viewerId) === peer) {
        this.closeOutgoing(viewerId);
      }
    };

    await peer.pc.setLocalDescription(await peer.pc.createOffer());
    this.send(viewerId, { kind: "offer", description: toDescription(peer.pc.localDescription!) });
    // A preferência de degradação só pode ser aplicada depois da negociação começar.
    if (videoSender) await applySenderProfile(videoSender, this.profile);
  }

  private async acceptOffer(sharerId: string, description: SessionDescription) {
    // Oferta de quem não estamos (mais) assistindo: avisa pra pessoa fechar o lado dela.
    if (!this.watching.has(sharerId)) {
      this.send(sharerId, { kind: "unwatch" });
      return;
    }

    this.closeIncoming(sharerId);
    const peer = new Peer(this.iceServers);
    this.incoming.set(sharerId, peer);

    peer.pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.send(sharerId, { kind: "viewer-candidate", candidate: toIceCandidate(candidate) });
    };
    peer.pc.ontrack = ({ streams, track }) => {
      // Áudio e vídeo chegam em eventos separados, mas no mesmo MediaStream.
      const current = this.watching.get(sharerId);
      if (!current || this.incoming.get(sharerId) !== peer) return;
      const stream = streams[0] ?? current.stream ?? new MediaStream();
      if (!stream.getTracks().includes(track)) stream.addTrack(track);
      this.updateWatch(sharerId, { stream });
    };
    peer.pc.onconnectionstatechange = () => {
      if (this.incoming.get(sharerId) !== peer) return;
      const state = peer.pc.connectionState;
      if (state === "connected") this.updateWatch(sharerId, { status: "live" });
      if (state === "failed") this.updateWatch(sharerId, { status: "failed" });
    };

    await peer.setRemoteDescription(description);
    await peer.pc.setLocalDescription(await peer.pc.createAnswer());
    this.send(sharerId, { kind: "answer", description: toDescription(peer.pc.localDescription!) });
  }

  // ---------- Utilitários ----------

  private closeOutgoing(viewerId: string) {
    const peer = this.outgoing.get(viewerId);
    if (!peer) return;
    peer.close();
    this.outgoing.delete(viewerId);
    this.notify();
  }

  private closeIncoming(sharerId: string) {
    this.incoming.get(sharerId)?.close();
    this.incoming.delete(sharerId);
  }

  private updateWatch(sharerId: string, patch: Partial<WatchState>) {
    const current = this.watching.get(sharerId);
    if (!current) return;
    this.watching.set(sharerId, { ...current, ...patch });
    this.notify();
  }

  private send(to: string, signal: Signal) {
    this.socket.emit("signal", { to, signal });
  }

  private notify() {
    this.onChange({
      localStream: this.localStream,
      localAudioMissing: this.audioMissing,
      viewerIds: [...this.outgoing.keys()],
      watching: Object.fromEntries(this.watching),
    });
  }
}

function toDescription(description: RTCSessionDescription): SessionDescription {
  return { type: description.type as SessionDescription["type"], sdp: description.sdp };
}

function toIceCandidate(candidate: RTCIceCandidate): IceCandidate {
  const { candidate: value = "", sdpMid, sdpMLineIndex, usernameFragment } = candidate.toJSON();
  return { candidate: value, sdpMid, sdpMLineIndex, usernameFragment };
}
