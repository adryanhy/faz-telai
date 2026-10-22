import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { NAME_MAX_LENGTH, normalizeName } from "@faz-telai/shared";
import { Logo } from "./Brand";

interface Props {
  roomId: string;
  initialName?: string;
  onSubmit: (name: string) => void;
}

export function NameForm({ roomId, initialName = "", onSubmit }: Props) {
  const [value, setValue] = useState(initialName);
  const name = normalizeName(value);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (name) onSubmit(name);
  }

  return (
    <form className="card center-card" onSubmit={handleSubmit}>
      <Logo />
      <div className="stack">
        <h1 className="room-title">Como seus amigos vão te chamar?</h1>
        <p className="muted small">
          Entrando na sala <strong>{roomId}</strong>
        </p>
      </div>
      <label className="sr-only" htmlFor="nickname">
        Apelido
      </label>
      <input
        id="nickname"
        className="input"
        autoFocus
        autoComplete="nickname"
        value={value}
        maxLength={NAME_MAX_LENGTH}
        placeholder="Seu apelido"
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={!name}>
        Entrar na sala
        <ArrowRight size={18} aria-hidden />
      </button>
    </form>
  );
}
