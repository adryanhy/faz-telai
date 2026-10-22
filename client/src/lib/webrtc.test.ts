import { afterEach, describe, expect, it, vi } from "vitest";
import { audioCaptureHint, Peer } from "./webrtc";

describe("audioCaptureHint", () => {
  afterEach(() => vi.unstubAllGlobals());

  const withUserAgent = (userAgent: string) => vi.stubGlobal("navigator", { userAgent });

  it("Firefox: avisa que não compartilha áudio", () => {
    withUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0");
    expect(audioCaptureHint()).toMatch(/Firefox não compartilha áudio/);
  });

  it("Mac: só áudio de aba", () => {
    withUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0 Safari/537.36");
    expect(audioCaptureHint()).toMatch(/No Mac/);
  });

  it("Windows/Chrome: tela inteira ou aba, janelas não levam som", () => {
    withUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36");
    expect(audioCaptureHint()).toMatch(/Janelas não levam som/);
  });
});

describe("Peer", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** RTCPeerConnection falso: só guarda o que recebeu. */
  class FakePeerConnection {
    remoteDescription: RTCSessionDescriptionInit | null = null;
    added: RTCIceCandidateInit[] = [];
    constructor(readonly config: RTCConfiguration) {}
    async setRemoteDescription(description: RTCSessionDescriptionInit) {
      this.remoteDescription = description;
    }
    async addIceCandidate(candidate: RTCIceCandidateInit) {
      if (!this.remoteDescription) throw new Error("InvalidStateError: sem descrição remota");
      this.added.push(candidate);
    }
    close() {}
  }

  it("repassa os servidores ICE pro RTCPeerConnection", () => {
    vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
    const peer = new Peer([{ urls: "stun:exemplo:3478" }]);
    expect((peer.pc as unknown as FakePeerConnection).config).toEqual({ iceServers: [{ urls: "stun:exemplo:3478" }] });
  });

  it("guarda candidatos que chegam antes da descrição remota e aplica depois, na ordem", async () => {
    vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
    const peer = new Peer([]);
    const pc = peer.pc as unknown as FakePeerConnection;

    await peer.addIceCandidate({ candidate: "a" });
    await peer.addIceCandidate({ candidate: "b" });
    expect(pc.added).toEqual([]);

    await peer.setRemoteDescription({ type: "offer", sdp: "v=0" });
    expect(pc.added).toEqual([{ candidate: "a" }, { candidate: "b" }]);

    await peer.addIceCandidate({ candidate: "c" });
    expect(pc.added.map((c) => c.candidate)).toEqual(["a", "b", "c"]);
  });
});
