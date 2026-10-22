import { useEffect, useRef, useState, type RefObject } from "react";
import type { WatchStatus } from "../lib/ScreenShare";

interface Props {
  label: string;
  stream: MediaStream | null;
  status: WatchStatus;
  /** A própria tela aparece sem som pra não dar eco, e sem controle de volume. */
  self?: boolean;
  onClose?: () => void;
  onRetry?: () => void;
}

const OVERLAY_TEXT: Partial<Record<WatchStatus, string>> = {
  connecting: "Conectando…",
  paused: "Parou de compartilhar. Volta sozinho se recomeçar.",
  failed: "Não deu pra conectar.",
};

export function VideoTile({ label, stream, status, self = false, onClose, onRetry }: Props) {
  const tileRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(self);
  const [fullscreen, setFullscreen] = useState(false);
  const stats = useVideoStats(videoRef, status === "live");

  useEffect(() => {
    const video = videoRef.current;
    if (!video || video.srcObject === stream) return;
    video.srcObject = stream;
    if (!stream) return;

    // Se o navegador bloquear autoplay com som, toca mudo e a pessoa liga o som no botão.
    video.play().catch(() => {
      setMuted(true);
      video.muted = true;
      return video.play().catch(() => {});
    });
  }, [stream]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    video.volume = volume;
  }, [muted, volume]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === tileRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else tileRef.current?.requestFullscreen().catch(() => {});
  }

  const overlay = OVERLAY_TEXT[status];
  const hasAudio = !self && (stream?.getAudioTracks().length ?? 0) > 0;

  return (
    <figure ref={tileRef} className="tile" onDoubleClick={toggleFullscreen}>
      <video ref={videoRef} autoPlay playsInline muted={muted} />
      {overlay && (
        <div className="tile-overlay">
          <p>{overlay}</p>
          {status === "failed" && onRetry && <button onClick={onRetry}>Tentar de novo</button>}
        </div>
      )}
      <figcaption className="tile-caption">
        <span>{label}</span>
        {onClose && (
          <button className="tile-button" onClick={onClose} aria-label={`Parar de assistir ${label}`}>
            ✕
          </button>
        )}
      </figcaption>
      {status === "live" && (
        <div className="tile-controls" onDoubleClick={(e) => e.stopPropagation()}>
          {hasAudio && (
            <>
              <button
                className="tile-button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? "Ligar som" : "Desligar som"}
              >
                {muted || volume === 0 ? "🔇" : "🔊"}
              </button>
              <input
                className="volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                aria-label="Volume"
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  setMuted(false);
                }}
              />
            </>
          )}
          {stats && <span className="tile-stats">{stats}</span>}
          <button
            className="tile-button push-right"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
          >
            {fullscreen ? "Sair" : "⛶"}
          </button>
        </div>
      )}
    </figure>
  );
}

/** Mede resolução e quadros por segundo realmente exibidos, pra saber se a qualidade está chegando. */
function useVideoStats(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean): string | null {
  const [stats, setStats] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!enabled || !video || !("requestVideoFrameCallback" in video)) {
      setStats(null);
      return;
    }

    let frames = 0;
    let handle = 0;
    const onFrame = () => {
      frames++;
      handle = video.requestVideoFrameCallback(onFrame);
    };
    handle = video.requestVideoFrameCallback(onFrame);

    const interval = setInterval(() => {
      if (video.videoWidth) setStats(`${video.videoWidth}×${video.videoHeight} · ${frames} fps`);
      frames = 0;
    }, 1000);

    return () => {
      clearInterval(interval);
      video.cancelVideoFrameCallback(handle);
    };
  }, [videoRef, enabled]);

  return stats;
}
