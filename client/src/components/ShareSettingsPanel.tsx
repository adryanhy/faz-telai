import { MODE_LABELS, type ShareMode, type ShareResolution, type ShareSettings } from "../lib/quality";

interface Props {
  settings: ShareSettings;
  sharing: boolean;
  onChange: (patch: Partial<ShareSettings>) => void;
}

const MODES: ShareMode[] = ["game", "browser"];
const RESOLUTIONS: ShareResolution[] = ["720p", "1080p"];

export function ShareSettingsPanel({ settings, sharing, onChange }: Props) {
  return (
    <div className="settings">
      <Segmented
        label="Modo"
        options={MODES.map((mode) => ({ value: mode, label: MODE_LABELS[mode].label }))}
        value={settings.mode}
        onChange={(mode) => onChange({ mode })}
      />
      <Segmented
        label="Resolução"
        options={RESOLUTIONS.map((resolution) => ({ value: resolution, label: resolution }))}
        value={settings.resolution}
        onChange={(resolution) => onChange({ resolution })}
      />
      <label
        className="checkbox"
        title={sharing ? "Pra mudar o áudio, pare e compartilhe de novo." : "No Windows, funciona ao compartilhar a tela inteira ou uma aba."}
      >
        <input
          type="checkbox"
          checked={settings.audio}
          disabled={sharing}
          onChange={(e) => onChange({ audio: e.target.checked })}
        />
        Áudio
      </label>
      <span className="muted small">{MODE_LABELS[settings.mode].hint}</span>
    </div>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
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
          className={option.value === value ? "active" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
