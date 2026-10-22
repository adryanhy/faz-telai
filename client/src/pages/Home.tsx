import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Gauge, LogIn, MousePointerClick, Plus, ShieldCheck, TriangleAlert } from "lucide-react";
import { Logo } from "../components/Brand";
import { generateRoomId, parseRoomInput } from "../lib/roomId";

export function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [invalid, setInvalid] = useState(false);

  function handleJoin(event: FormEvent) {
    event.preventDefault();
    const roomId = parseRoomInput(code);
    if (!roomId) return setInvalid(true);
    navigate(`/sala/${roomId}`);
  }

  return (
    <main className="home">
      <header className="hero">
        <Logo large />
        <h1 className="hero-title">
          Faz tel<span className="accent">ai</span>
        </h1>
        <p className="hero-tagline">App anti-janja</p>
      </header>

      <section className="card home-card">
        <div className="stack">
          <h2>Nova sala</h2>
          <p className="muted">Crie uma sala e manda o link</p>
          <button className="btn btn-primary btn-lg btn-block" onClick={() => navigate(`/sala/${generateRoomId()}`)}>
            <Plus size={20} aria-hidden />
            Criar sala
          </button>
        </div>

        <div className="divider" aria-hidden>
          ou
        </div>

        <form className="stack" onSubmit={handleJoin} noValidate>
          <label className="field-label" htmlFor="room-code">
            Entrar numa sala
          </label>
          <div className="input-row">
            <input
              id="room-code"
              className="input"
              value={code}
              placeholder="Link ou código"
              autoComplete="off"
              aria-invalid={invalid}
              aria-describedby={invalid ? "room-code-error" : undefined}
              onChange={(e) => {
                setCode(e.target.value);
                setInvalid(false);
              }}
            />
            <button type="submit" className="btn" disabled={!code.trim()}>
              <LogIn size={18} aria-hidden />
              Entrar
            </button>
          </div>
          {invalid && (
            <p id="room-code-error" className="error">
              <TriangleAlert size={16} aria-hidden />
              Link ou código inválido. Cole o link inteiro ou algo como capivara-turbo-k7q2.
            </p>
          )}
        </form>
      </section>

      <ul className="features">
        <li>
          <MousePointerClick size={20} aria-hidden />
          Sem instalar nada
        </li>
        <li>
          <Gauge size={20} aria-hidden />
          Até 1080p a 60fps
        </li>
        <li>
          <ShieldCheck size={20} aria-hidden />
          Direto entre vocês
        </li>
      </ul>
    </main>
  );
}
