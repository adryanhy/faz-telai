import type { ReactNode } from "react";
import { Gamepad2, Globe, Volume2, VolumeX } from "lucide-react";
import { MODE_LABELS, type ShareMode, type ShareResolution, type ShareSettings } from "../lib/quality";

interface Props {
  settings: ShareSettings;
  sharing: boolean;
  onChange: (patch: Partial<ShareSettings>) => void;
}

const MODE_ICONS: Record<ShareMode, ReactNode> = {
  game: <Gamepad2 size={16} aria-hidden />,
  browser: <Globe size={16} aria-hidden />,
};

const MODES: ShareMode[] = ["game", "browser"];
const RESOLUTIONS: ShareResolution[] = ["720p", "1080p"];

export function ShareSettingsPanel({ settings, sharing, onChange }: Props) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="settings">
        <Segmented
          label="Modo"
          options={MODES.map((mode) => ({ value: mode, label: MODE_LABELS[mode].label, icon: MODE_ICONS[mode] }))}
          value={settings.mode}
          onChange={(mode) => onChange({ mode })}
        />
        <Segmented
          label="Resolução"
          options={RESOLUTIONS.map((resolution) => ({ value: resolution, label: resolution }))}
          value={settings.resolution}
          onChange={(resolution) => onChange({ resolution })}
        />
        <button
          type="button"
          className="toggle"
          aria-pressed={settings.audio}
          disabled={sharing}
          title={
            sharing
              ? "Pra mudar o áudio, pare e compartilhe de novo."
              : "No Windows, funciona ao compartilhar a tela inteira ou uma aba."
          }
          onClick={() => onChange({ audio: !settings.audio })}
        >
          {settings.audio ? <Volume2 size={16} aria-hidden /> : <VolumeX size={16} aria-hidden />}
          Áudio
        </button>
      </div>
      <p className="settings-hint">{MODE_LABELS[settings.mode].hint}</p>
    </div>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}

function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
