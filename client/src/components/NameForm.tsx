import { useState, type FormEvent } from "react";
import { NAME_MAX_LENGTH, normalizeName } from "@faz-telai/shared";

interface Props {
  initialName?: string;
  onSubmit: (name: string) => void;
}

export function NameForm({ initialName = "", onSubmit }: Props) {
  const [value, setValue] = useState(initialName);
  const name = normalizeName(value);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (name) onSubmit(name);
  }

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <h2>Como seus amigos vão te chamar?</h2>
      <input
        autoFocus
        value={value}
        maxLength={NAME_MAX_LENGTH}
        placeholder="Seu apelido"
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="primary" disabled={!name}>
        Entrar na sala
      </button>
    </form>
  );
}
