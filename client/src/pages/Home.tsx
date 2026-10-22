import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
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
    <main className="page narrow stack-lg">
      <header className="hero">
        <h1>
          Faz tel<span className="accent">ai</span> 📺
        </h1>
        <p className="muted">App anti-janja</p>
      </header>

      <section className="card stack">
        <h2>Nova sala</h2>
        <p className="muted">Crie uma sala e manda o link</p>
        <button className="primary" onClick={() => navigate(`/sala/${generateRoomId()}`)}>
          Criar sala
        </button>
      </section>

      <form className="card stack" onSubmit={handleJoin}>
        <h2>Entrar numa sala</h2>
        <input
          value={code}
          placeholder="Cole o link ou o código (ex.: capivara-turbo-k7q2)"
          aria-invalid={invalid}
          onChange={(e) => {
            setCode(e.target.value);
            setInvalid(false);
          }}
        />
        {invalid && <p className="error">Link ou código inválido.</p>}
        <button type="submit" disabled={!code.trim()}>
          Entrar
        </button>
      </form>
    </main>
  );
}
