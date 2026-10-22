import { describe, expect, it, vi } from "vitest";
import { applySenderProfile, captureConstraints, getProfile } from "./quality";

describe("getProfile", () => {
  it("modo Jogo prioriza fluidez: 60fps e manter quadros", () => {
    expect(getProfile({ mode: "game", resolution: "1080p", audio: true })).toEqual({
      width: 1920,
      height: 1080,
      frameRate: 60,
      maxBitrate: 8_000_000,
      contentHint: "motion",
      degradationPreference: "maintain-framerate",
    });
  });

  it("modo Navegador prioriza nitidez: 30fps e manter resolução", () => {
    expect(getProfile({ mode: "browser", resolution: "720p", audio: false })).toEqual({
      width: 1280,
      height: 720,
      frameRate: 30,
      maxBitrate: 2_000_000,
      contentHint: "detail",
      degradationPreference: "maintain-resolution",
    });
  });

  it("720p sempre gasta menos banda que 1080p no mesmo modo", () => {
    for (const mode of ["game", "browser"] as const) {
      const low = getProfile({ mode, resolution: "720p", audio: true });
      const high = getProfile({ mode, resolution: "1080p", audio: true });
      expect(low.maxBitrate).toBeLessThan(high.maxBitrate);
    }
  });
});

describe("captureConstraints", () => {
  it("usa max (o navegador pode reduzir, mantendo a proporção) e nunca exact/min", () => {
    const constraints = captureConstraints(getProfile({ mode: "game", resolution: "720p", audio: true }));
    expect(constraints).toEqual({
      width: { max: 1280 },
      height: { max: 720 },
      frameRate: { ideal: 60, max: 60 },
    });
  });
});

describe("applySenderProfile", () => {
  function fakeSender(encodings: RTCRtpEncodingParameters[]) {
    const params = { encodings } as unknown as RTCRtpSendParameters;
    return {
      getParameters: vi.fn(() => params),
      setParameters: vi.fn(async () => {}),
    } as unknown as RTCRtpSender & { setParameters: ReturnType<typeof vi.fn> };
  }

  it("aplica teto de bitrate, fps e preferência de degradação", async () => {
    const sender = fakeSender([{}]);
    await applySenderProfile(sender, getProfile({ mode: "game", resolution: "1080p", audio: true }));

    expect(sender.setParameters).toHaveBeenCalledWith(
      expect.objectContaining({
        encodings: [{ maxBitrate: 8_000_000, maxFramerate: 60 }],
        degradationPreference: "maintain-framerate",
      }),
    );
  });

  it("não faz nada antes da negociação (sem encodings)", async () => {
    const sender = fakeSender([]);
    await applySenderProfile(sender, getProfile({ mode: "browser", resolution: "720p", audio: true }));
    expect(sender.setParameters).not.toHaveBeenCalled();
  });
});
