import { MonitorPlay } from "lucide-react";
import { Link } from "react-router";

export function Logo({ large = false }: { large?: boolean }) {
  return (
    <span className={large ? "logo logo-lg" : "logo"} aria-hidden>
      <MonitorPlay size={large ? 32 : 18} strokeWidth={2} />
    </span>
  );
}

/** Logo + nome, voltando pro início. */
export function BrandLink() {
  return (
    <Link to="/" className="brand" aria-label="Faz telai, voltar ao início">
      <Logo />
      <span aria-hidden>
        Faz tel<span className="accent">ai</span>
      </span>
    </Link>
  );
}

// Pares de gradiente pros avatares: cada apelido cai sempre na mesma cor.
const AVATAR_GRADIENTS = [
  ["#8b5cf6", "#6d28d9"],
  ["#ec4899", "#be185d"],
  ["#06b6d4", "#0e7490"],
  ["#f59e0b", "#b45309"],
  ["#10b981", "#047857"],
  ["#6366f1", "#4338ca"],
] as const;

export function Avatar({ name, live = false }: { name: string; live?: boolean }) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const [from, to] = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]!;

  return (
    <span
      className={live ? "avatar is-live" : "avatar"}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      aria-hidden
    >
      {name[0]?.toUpperCase()}
    </span>
  );
}
