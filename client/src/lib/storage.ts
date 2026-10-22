import { DEFAULT_SETTINGS, type ShareSettings } from "./quality";

// localStorage pode lançar erro (aba anônima, cookies bloqueados), então tudo passa por try/catch.

const NAME_KEY = "faz-telai:name";

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Sem localStorage o apelido só vale para esta aba.
  }
}

const SETTINGS_KEY = "faz-telai:share-settings";

/** Lê as últimas configurações de compartilhamento, descartando valores que não reconhecemos. */
export function loadSettings(): ShareSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<ShareSettings>;
    return {
      mode: saved.mode === "game" || saved.mode === "browser" ? saved.mode : DEFAULT_SETTINGS.mode,
      resolution:
        saved.resolution === "720p" || saved.resolution === "1080p" ? saved.resolution : DEFAULT_SETTINGS.resolution,
      audio: typeof saved.audio === "boolean" ? saved.audio : DEFAULT_SETTINGS.audio,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: ShareSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Sem localStorage as configurações só valem para esta aba.
  }
}
