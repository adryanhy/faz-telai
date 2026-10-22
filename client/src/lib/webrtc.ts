import type { IceServer } from "@faz-telai/shared";

// Usado só até o servidor mandar a lista definitiva (com TURN) ao entrar na sala.
// STUN descobre o IP público de cada um; TURN retransmite quando a conexão direta falha.
export const FALLBACK_ICE_SERVERS: IceServer[] = [{ urls: ["stun:stun.l.google.com:19302"] }];

export function canShareScreen(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
}

/**
 * Embrulha um RTCPeerConnection e resolve um detalhe chato do WebRTC:
 * candidatos ICE podem chegar antes da descrição remota, e o navegador
 * recusa adicioná-los nessa hora. Então guardamos numa fila até poder.
 */
export class Peer {
  readonly pc: RTCPeerConnection;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(iceServers: IceServer[]) {
    this.pc = new RTCPeerConnection({ iceServers });
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    await this.pc.setRemoteDescription(description);
    const pending = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of pending) await this.pc.addIceCandidate(candidate);
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    await this.pc.addIceCandidate(candidate);
  }

  close() {
    this.pc.close();
  }
}
