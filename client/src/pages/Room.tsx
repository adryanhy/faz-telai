import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  MonitorOff,
  MonitorUp,
  Pencil,
  Radio,
  TriangleAlert,
  Users,
  VolumeX,
} from "lucide-react";
import { isValidRoomId, MAX_PARTICIPANTS, type JoinError } from "@faz-telai/shared";
import { Avatar, BrandLink } from "../components/Brand";
import { NameForm } from "../components/NameForm";
import { ShareSettingsPanel } from "../components/ShareSettingsPanel";
import { VideoTile } from "../components/VideoTile";
import { useRoom, type RoomStatus } from "../hooks/useRoom";
import { loadName, saveName } from "../lib/storage";
import { audioCaptureHint, canShareScreen } from "../lib/webrtc";

const ERROR_MESSAGES: Record<JoinError, string> = {
  "invalid-room": "Esse código de sala não é válido.",
  "invalid-name": "Esse apelido não é válido.",
  "room-full": `A sala está cheia (máximo de ${MAX_PARTICIPANTS} pessoas).`,
};

export function Room() {
  const { roomId = "" } = useParams();
  const [name, setName] = useState<string | null>(() => loadName() || null);
  const [editingName, setEditingName] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // O hook só conecta com sala válida, apelido definido e fora da edição do apelido.
  const room = useRoom(roomId, editingName || !isValidRoomId(roomId) ? null : name);

  if (!isValidRoomId(roomId)) {
    return <ErrorScreen message={ERROR_MESSAGES["invalid-room"]} />;
  }

  if (!name || editingName) {
    return (
      <main className="center-page">
        <NameForm
          roomId={roomId}
          initialName={name ?? ""}
          onSubmit={(newName) => {
            saveName(newName);
            setName(newName);
            setEditingName(false);
          }}
        />
      </main>
    );
  }

  if (room.status.kind === "error") {
    return <ErrorScreen message={ERROR_MESSAGES[room.status.error]} />;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie o link da sala:", window.location.href);
    }
  }

  async function startSharing() {
    setShareError(null);
    setStarting(true);
    try {
      await room.startSharing();
    } catch (error) {
      // NotAllowedError = a pessoa fechou o seletor de tela. Não é erro de verdade.
      if (error instanceof DOMException && error.name === "NotAllowedError") return;
      setShareError("Não foi possível compartilhar a tela. Tente de novo ou escolha outra janela.");
      console.error(error);
    } finally {
      setStarting(false);
    }
  }

  const { localStream, viewerIds, watching } = room.share;
  const nameOf = (id: string) => room.participants.find((p) => p.id === id)?.name ?? "Alguém";
  const watchedIds = Object.keys(watching);
  const othersSharing = room.participants.filter((p) => p.sharing && p.id !== room.selfId);
  const joined = room.status.kind === "joined";
  const tileCount = watchedIds.length + (localStream ? 1 : 0);

  return (
    <main className="room">
      <header className="room-header">
        <div className="room-heading">
          <BrandLink />
          <span className="separator" aria-hidden />
          <div>
            <p className="room-eyebrow">Sala</p>
            <h1 className="room-title">{roomId}</h1>
          </div>
        </div>
        <div className="row">
          <StatusBadge status={room.status} />
          <button className="btn" onClick={copyLink}>
            {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
            {copied ? "Link copiado!" : "Copiar link"}
          </button>
        </div>
      </header>

      <div className="room-layout">
        <div className="room-main">
          <section className="card toolbar" aria-label="Compartilhamento">
            {canShareScreen() ? (
              <>
                <ShareSettingsPanel settings={room.settings} sharing={!!localStream} onChange={room.changeSettings} />
                <div className="toolbar-action">
                  {localStream ? (
                    <>
                      <span className="live-pill">
                        <span className="live-dot" aria-hidden />
                        Ao vivo
                      </span>
                      <span className="viewers">
                        <Eye size={16} aria-hidden />
                        {viewerIds.length === 0
                          ? "Ninguém assistindo"
                          : `${viewerIds.map(nameOf).join(", ")} assistindo`}
                      </span>
                      <button className="btn btn-danger" onClick={room.stopSharing}>
                        <MonitorOff size={18} aria-hidden />
                        Parar
                      </button>
                    </>
                  ) : (
                    // Com alguém ao vivo, a ação principal da tela passa a ser "Assistir".
                    <button
                      className={othersSharing.length > 0 ? "btn btn-lg" : "btn btn-primary btn-lg"}
                      onClick={startSharing}
                      disabled={!joined || starting}
                    >
                      <MonitorUp size={20} aria-hidden />
                      Compartilhar minha tela
                    </button>
                  )}
                </div>
                {localStream && room.share.localAudioMissing && (
                  <div className="notice" role="status">
                    <VolumeX size={18} aria-hidden />
                    <div>
                      <p>
                        <strong>Sua transmissão está sem som.</strong> {audioCaptureHint()}
                      </p>
                      <p className="muted small">Pra corrigir, clique em Parar e compartilhe de novo.</p>
                    </div>
                  </div>
                )}
                {shareError && (
                  <p className="error" role="alert">
                    <TriangleAlert size={16} aria-hidden />
                    {shareError}
                  </p>
                )}
              </>
            ) : (
              <p className="muted">
                Este navegador não permite compartilhar a tela. Dá pra assistir normalmente; pra compartilhar, use Chrome,
                Edge ou Firefox no computador.
              </p>
            )}
          </section>

          {tileCount > 0 ? (
            <section className={`tiles tiles-${Math.min(tileCount, 4)}`} aria-label="Telas">
              {localStream && <VideoTile label="Sua tela" stream={localStream} status="live" self />}
              {watchedIds.map((id) => {
                const watch = watching[id]!;
                return (
                  <VideoTile
                    key={id}
                    label={nameOf(id)}
                    stream={watch.stream}
                    status={watch.status}
                    onClose={() => room.unwatch(id)}
                    onRetry={() => room.watch(id)}
                  />
                );
              })}
            </section>
          ) : (
            <section className="card stage-empty">
              <span className="empty-icon" aria-hidden>
                <MonitorUp size={26} />
              </span>
              {othersSharing.length > 0 ? (
                <>
                  <h2>
                    {othersSharing.map((p) => p.name).join(", ")} {othersSharing.length > 1 ? "estão" : "está"} ao vivo
                  </h2>
                  <p className="muted">Escolha uma tela pra assistir.</p>
                  <div className="row" style={{ justifyContent: "center" }}>
                    {othersSharing.map((p) => (
                      <button key={p.id} className="btn btn-primary" onClick={() => room.watch(p.id)}>
                        <Eye size={18} aria-hidden />
                        Assistir {p.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h2>Ninguém está compartilhando ainda</h2>
                  <p className="muted">
                    Quando alguém compartilhar, a tela aparece aqui. Mande o link da sala pra galera entrar.
                  </p>
                </>
              )}
            </section>
          )}
        </div>

        <aside className="card sidebar" aria-label="Participantes">
          <div className="sidebar-header">
            <h2 className="row" style={{ gap: 8 }}>
              <Users size={18} className="muted" aria-hidden />
              Na sala
            </h2>
            <span className="count" aria-label={`${room.participants.length} pessoas na sala`}>
              {room.participants.length}
            </span>
          </div>

          <ul className="participants">
            {room.participants.map((p) => {
              const isSelf = p.id === room.selfId;
              const isWatching = p.id in watching;
              return (
                <li key={p.id} className="participant">
                  <Avatar name={p.name} live={p.sharing} />
                  <div className="participant-info">
                    <span className="participant-name">
                      {p.name}
                      {isSelf && <span className="muted"> (você)</span>}
                    </span>
                    <span className={p.sharing ? "participant-meta is-live" : "participant-meta"}>
                      {p.sharing && <Radio size={12} aria-hidden />}
                      {p.sharing ? "Ao vivo" : "Na sala"}
                    </span>
                  </div>
                  {p.sharing && !isSelf && (
                    <button
                      className="btn btn-sm"
                      onClick={() => (isWatching ? room.unwatch(p.id) : room.watch(p.id))}
                      aria-label={isWatching ? `Parar de assistir ${p.name}` : `Assistir ${p.name}`}
                    >
                      {isWatching ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                      {isWatching ? "Parar" : "Assistir"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setEditingName(true)}>
            <Pencil size={14} aria-hidden />
            Trocar apelido
          </button>
        </aside>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: Exclude<RoomStatus, { kind: "error" }> }) {
  const label = { connecting: "Conectando…", joined: "Conectado", reconnecting: "Reconectando…" }[status.kind];
  return (
    <span className={`status status-${status.kind}`} role="status">
      <span className="status-dot" aria-hidden />
      {label}
    </span>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="center-page">
      <div className="card center-card">
        <span className="empty-icon" aria-hidden>
          <TriangleAlert size={26} />
        </span>
        <h1 className="room-title">Ops!</h1>
        <p className="muted">{message}</p>
        <Link to="/" className="btn btn-primary btn-lg btn-block">
          <ArrowLeft size={18} aria-hidden />
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
