import { expect, type Browser, type Page } from "@playwright/test";

interface FakeScreenOptions {
  /** A "tela" capturada vem com uma trilha de áudio (um tom de 440 Hz)? */
  audio: boolean;
}

/**
 * O seletor de tela do navegador não dá pra automatizar, então trocamos o getDisplayMedia
 * por uma tela falsa: um canvas animado e, opcionalmente, um tom gerado pelo Web Audio.
 * Todo o resto (WebRTC, sinalização, interface) roda de verdade.
 */
function installFakeScreen({ audio }: FakeScreenOptions) {
  // Guarda as conexões criadas pelo app pra conferir estatísticas reais (ex.: áudio chegando).
  const connections: RTCPeerConnection[] = [];
  (window as unknown as { __connections: RTCPeerConnection[] }).__connections = connections;
  const OriginalPeerConnection = window.RTCPeerConnection;
  window.RTCPeerConnection = class extends OriginalPeerConnection {
    constructor(config?: RTCConfiguration) {
      super(config);
      connections.push(this);
    }
  };

  navigator.mediaDevices.getDisplayMedia = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d")!;
    let frame = 0;
    setInterval(() => {
      frame++;
      ctx.fillStyle = `hsl(${frame % 360} 60% 35%)`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 96px sans-serif";
      ctx.fillText(`TELA ${frame}`, 80, 400);
    }, 33);
    const stream = canvas.captureStream(30);

    if (audio) {
      const context = new AudioContext();
      await context.resume();
      const oscillator = context.createOscillator();
      const destination = context.createMediaStreamDestination();
      oscillator.connect(destination);
      oscillator.start();
      stream.addTrack(destination.stream.getAudioTracks()[0]!);
    }
    return stream;
  };
}

/** Abre uma "pessoa" nova (contexto isolado, com seu próprio localStorage). */
export async function newPerson(browser: Browser, screen: FakeScreenOptions = { audio: true }) {
  const context = await browser.newContext();
  await context.addInitScript(installFakeScreen, screen);
  return context.newPage();
}

/** Entra na sala informando o apelido e espera conectar. */
export async function enterRoom(page: Page, roomId: string, name: string) {
  await page.goto(`/sala/${roomId}`);
  await page.getByLabel("Apelido").fill(name);
  await page.getByRole("button", { name: "Entrar na sala" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Conectado" })).toBeVisible();
}

export function uniqueRoomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Bytes de áudio recebidos e volume detectado, somando todas as conexões da página. */
export function receivedAudio(page: Page) {
  return page.evaluate(async () => {
    const connections = (window as unknown as { __connections: RTCPeerConnection[] }).__connections;
    let bytes = 0;
    let level = 0;
    for (const pc of connections) {
      if (pc.connectionState === "closed") continue;
      (await pc.getStats()).forEach((report) => {
        if (report.type === "inbound-rtp" && report.kind === "audio") {
          bytes += report.bytesReceived ?? 0;
          level = Math.max(level, report.audioLevel ?? 0);
        }
      });
    }
    return { bytes, level };
  });
}

/** Espera o vídeo da tela de `label` estar tocando de verdade (quadros chegando). */
export async function expectVideoPlaying(page: Page, label: string) {
  const tile = page.locator(".tile", { has: page.locator(".chip", { hasText: label }) });
  await expect(tile).toBeVisible();
  await expect
    .poll(
      () =>
        tile.locator("video").evaluate((video: HTMLVideoElement) => {
          return video.videoWidth > 0 && video.currentTime > 0.5 && !video.paused;
        }),
      { timeout: 15_000 },
    )
    .toBe(true);
  return tile;
}
