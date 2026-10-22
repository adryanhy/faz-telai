import type { IceServer } from "@faz-telai/shared";

// Usado só até o servidor mandar a lista definitiva (com TURN) ao entrar na sala.
// STUN descobre o IP público de cada um; TURN retransmite quando a conexão direta falha.
export const FALLBACK_ICE_SERVERS: IceServer[] = [{ urls: ["stun:stun.l.google.com:19302"] }];

export function canShareScreen(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
}

/**
 * Como conseguir som na captura, de acordo com o navegador/sistema.
 * O suporte a áudio do getDisplayMedia varia muito e o navegador não explica nada sozinho.
 */
export function audioCaptureHint(): string {
  const ua = navigator.userAgent;
  if (/Firefox\//.test(ua)) return "O Firefox não compartilha áudio. Pra transmitir com som, use Chrome ou Edge.";
  if (/Mac OS X|Macintosh/.test(ua)) {
    return "No Mac, o som só vai junto ao compartilhar uma Aba do Chrome/Edge, com “Compartilhar áudio” marcado.";
  }
  return "O som só vai junto ao compartilhar a Tela inteira ou uma Aba, com “Compartilhar áudio” marcado. Janelas não levam som.";
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
