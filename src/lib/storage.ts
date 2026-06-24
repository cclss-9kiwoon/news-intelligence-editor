export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('[storage] save failed', key, err);
  }
}

export const STORAGE_KEYS = {
  settings: 'nie:settings',
  // v2: 단일 드래프트 스키마. 구버전 'nie:history'(3채널/이중언어)는 로드하지 않고 폐기.
  history: 'nie:history.v2',
  // 폐기/거부 원장 — 재유입 차단(영속). 삭제된 task와 무관하게 잔존.
  discarded: 'nie:discarded.v1',
  // LLM 사용량/비용 원장(영속) — 대시보드·예산 가드 근거.
  usage: 'nie:usage.v1',
} as const;

// ─── File-based settings backup ─────────────────────────────────────
// Persists settings to a local file via Vite dev server so they survive
// localStorage wipes (port changes, cache clears, etc.)

let backupTimer: ReturnType<typeof setTimeout> | null = null;

/** Keys stripped from backup — never persisted to disk */
const SENSITIVE_KEYS = ['apiKey', 'apiBaseUrl', 'naverClientId', 'naverClientSecret', 'rss2jsonApiKey'];

function stripSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.includes(k)) continue;
    out[k] = v;
  }
  return out;
}

/** Save settings to file-based backup (debounced). Sensitive fields (API keys) excluded. */
export function backupSettingsToFile(settings: unknown): void {
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(async () => {
    try {
      const safe = typeof settings === 'object' && settings !== null
        ? stripSensitive(settings as Record<string, unknown>)
        : settings;
      await fetch('/api/settings-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(safe),
      });
      console.log('[storage] settings backed up to file (keys excluded)');
    } catch {
      // Dev server may not be available (production build) — silently ignore
    }
  }, 2000);
}

/** Try to restore settings from file backup. Returns null if none found. */
export async function restoreSettingsFromFile<T>(): Promise<T | null> {
  try {
    const res = await fetch('/api/settings-backup');
    if (!res.ok) return null;
    const data = await res.json();
    console.log('[storage] settings restored from file backup');
    return data as T;
  } catch {
    return null;
  }
}
