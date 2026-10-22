import { useState } from "react";
import { Link, useParams } from "react-router";
import { isValidRoomId, MAX_PARTICIPANTS, type JoinError } from "@faz-telai/shared";
import { NameForm } from "../components/NameForm";
import { ShareSettingsPanel } from "../components/ShareSettingsPanel";
import { VideoTile } from "../components/VideoTile";
import { useRoom } from "../hooks/useRoom";
import { loadName, saveName } from "../lib/storage";
import { canShareScreen } from "../lib/webrtc";

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

  // O hook só conecta com sala válida, apelido definido e fora da edição do apelido.
  const room = useRoom(roomId, editingName || !isValidRoomId(roomId) ? null : name);

  if (!isValidRoomId(roomId)) {
    return <ErrorScreen message={ERROR_MESSAGES["invalid-room"]} />;
  }

  if (!name || editingName) {
    return (
      <main className="page narrow">
        <NameForm
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
    try {
      await room.startSharing();
    } catch (error) {
      // NotAllowedError = a pessoa fechou o seletor de tela. Não é erro de verdade.
      if (error instanceof DOMException && error.name === "NotAllowedError") return;
      setShareError("Não foi possível compartilhar a tela.");
      console.error(error);
    }
  }

  const { localStream, viewerIds, watching } = room.share;
  const nameOf = (id: string) => room.participants.find((p) => p.id === id)?.name ?? "Alguém";
  const watchedIds = Object.keys(watching);
  const othersSharing = room.participants.filter((p) => p.sharing && p.id !== room.selfId);
  const joined = room.status.kind === "joined";

  return (
    <main className="page stack-lg">
      <header className="room-header">
        <div>
          <Link to="/" className="muted small">
            ← Faz telai
          </Link>
          <h1 className="room-title">{roomId}</h1>
        </div>
        <div className="row">
          <StatusBadge kind={room.status.kind} />
          <button onClick={copyLink}>{copied ? "Link copiado!" : "Copiar link"}</button>
        </div>
      </header>

      <div className="room-layout">
        <div className="stack">
          <section className="card toolbar">
            {canShareScreen() && (
              <ShareSettingsPanel settings={room.settings} sharing={!!localStream} onChange={room.changeSettings} />
            )}
            {localStream ? (
              <>
                <span className="live-dot" aria-hidden />
                <span>
                  Você está compartilhando ·{" "}
                  <span className="muted">
                    {viewerIds.length === 0
                      ? "ninguém assistindo ainda"
                      : `${viewerIds.length} assistindo (${viewerIds.map(nameOf).join(", ")})`}
                  </span>
                </span>
                <button className="danger" onClick={room.stopSharing}>
                  Parar de compartilhar
                </button>
              </>
            ) : canShareScreen() ? (
              <>
                <button className="primary" onClick={startSharing} disabled={!joined}>
                  Compartilhar minha tela
                </button>
                {shareError && <span className="error">{shareError}</span>}
              </>
            ) : (
              <span className="muted">
                Este navegador não permite compartilhar a tela. Use Chrome, Edge ou Firefox no computador.
              </span>
            )}
          </section>

          {localStream || watchedIds.length > 0 ? (
            <section className={`tiles tiles-${Math.min(watchedIds.length + (localStream ? 1 : 0), 4)}`}>
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
            <section className="card stage">
              <p className="muted">
                {othersSharing.length > 0
                  ? `${othersSharing.map((p) => p.name).join(", ")} ${othersSharing.length > 1 ? "estão" : "está"} compartilhando. Clique em "Assistir" na lista ao lado.`
                  : "Ninguém está compartilhando ainda."}
              </p>
            </section>
          )}
        </div>

        <aside className="card stack">
          <h2>
            Na sala <span className="muted">({room.participants.length})</span>
          </h2>
          <ul className="participants">
            {room.participants.map((p) => {
              const isSelf = p.id === room.selfId;
              const isWatching = p.id in watching;
              return (
                <li key={p.id}>
                  <span className="avatar" aria-hidden>
                    {p.name[0]?.toUpperCase()}
                  </span>
                  <span className="participant-name">
                    {p.name}
                    {isSelf && <span className="muted small"> (você)</span>}
                    {p.sharing && <span className="live-tag">ao vivo</span>}
                  </span>
                  {p.sharing && !isSelf && (
                    <button
                      className={isWatching ? "small-button" : "small-button primary"}
                      onClick={() => (isWatching ? room.unwatch(p.id) : room.watch(p.id))}
                    >
                      {isWatching ? "Parar" : "Assistir"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <button className="link-button" onClick={() => setEditingName(true)}>
            Trocar apelido
          </button>
        </aside>
      </div>
    </main>
  );
}

function StatusBadge({ kind }: { kind: "connecting" | "joined" | "reconnecting" }) {
  const label = { connecting: "Conectando…", joined: "Conectado", reconnecting: "Reconectando…" }[kind];
  return <span className={`badge badge-${kind}`}>{label}</span>;
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="page narrow">
      <div className="card stack">
        <h2>Ops!</h2>
        <p>{message}</p>
        <Link to="/" className="button primary">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
