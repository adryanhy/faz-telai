export type ShareMode = "game" | "browser";
export type ShareResolution = "720p" | "1080p";
// Declarado aqui porque nem toda versão dos tipos do DOM inclui RTCDegradationPreference.
type DegradationPreference = "maintain-framerate" | "maintain-resolution" | "balanced";

export interface ShareSettings {
  mode: ShareMode;
  resolution: ShareResolution;
  /** Áudio do sistema/aba. Só vale no início: trocar exige compartilhar de novo. */
  audio: boolean;
}

export const DEFAULT_SETTINGS: ShareSettings = { mode: "game", resolution: "1080p", audio: true };

export interface QualityProfile {
  width: number;
  height: number;
  frameRate: number;
  /** Teto de bits por segundo enviados para cada pessoa assistindo. */
  maxBitrate: number;
  /** Dica pro codificador: "motion" aceita perder nitidez, "detail" aceita perder quadros. */
  contentHint: "motion" | "detail";
  /** O que sacrificar quando a rede apertar. */
  degradationPreference: DegradationPreference;
}

const RESOLUTIONS: Record<ShareResolution, { width: number; height: number }> = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
};

// Bitrates pensados para upload doméstico: com 3 pessoas assistindo um jogo em 1080p,
// quem compartilha envia até ~24 Mbps. Se travar, 720p usa pouco mais da metade.
const BITRATES: Record<ShareMode, Record<ShareResolution, number>> = {
  game: { "720p": 4_500_000, "1080p": 8_000_000 },
  browser: { "720p": 2_000_000, "1080p": 3_500_000 },
};

export function getProfile({ mode, resolution }: ShareSettings): QualityProfile {
  return {
    ...RESOLUTIONS[resolution],
    frameRate: mode === "game" ? 60 : 30,
    maxBitrate: BITRATES[mode][resolution],
    contentHint: mode === "game" ? "motion" : "detail",
    degradationPreference: mode === "game" ? "maintain-framerate" : "maintain-resolution",
  };
}

export const MODE_LABELS: Record<ShareMode, { label: string; hint: string }> = {
  game: { label: "Jogo", hint: "60fps, prioriza fluidez" },
  browser: { label: "Navegador", hint: "30fps, prioriza texto nítido" },
};

/**
 * Áudio de jogo/música não é voz: sem isso o navegador pode tratar a captura como microfone
 * e aplicar cancelamento de eco e supressão de ruído, que abafam ou cortam o som.
 */
export const DISPLAY_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

/** Restrições de captura: "max" deixa o navegador reduzir a tela mantendo a proporção. */
export function captureConstraints(profile: QualityProfile): MediaTrackConstraints {
  return {
    width: { max: profile.width },
    height: { max: profile.height },
    frameRate: { ideal: profile.frameRate, max: profile.frameRate },
  };
}

/** Aplica teto de bitrate, fps e preferência de degradação num sender de vídeo. */
export async function applySenderProfile(sender: RTCRtpSender, profile: QualityProfile) {
  const params = sender.getParameters();
  if (!params.encodings?.length) return; // ainda não negociado; será aplicado depois
  for (const encoding of params.encodings) {
    encoding.maxBitrate = profile.maxBitrate;
    encoding.maxFramerate = profile.frameRate;
  }
  // Chrome/Edge leem a preferência daqui; quem não entende simplesmente ignora.
  (params as RTCRtpSendParameters & { degradationPreference?: DegradationPreference }).degradationPreference =
    profile.degradationPreference;
  await sender.setParameters(params);
}
