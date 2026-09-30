const KEY = 'avalon-settings'

export interface AppSettings {
  talkSec: number
  challengeSec: number
}

const DEFAULTS: AppSettings = {
  talkSec: 60,
  challengeSec: 30,
}

const MIN_SEC = 10
const MAX_SEC = 300

function clampSec(n: number): number {
  if (!Number.isFinite(n)) return MIN_SEC
  return Math.min(MAX_SEC, Math.max(MIN_SEC, Math.round(n)))
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const data = JSON.parse(raw) as Partial<AppSettings>
    const talkSec = clampSec(
      typeof data.talkSec === 'number' ? data.talkSec : DEFAULTS.talkSec,
    )
    const challengeSec = clampSec(
      typeof data.challengeSec === 'number'
        ? data.challengeSec
        : Math.max(MIN_SEC, Math.round(talkSec / 2)),
    )
    return { talkSec, challengeSec }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(next: AppSettings) {
  const payload: AppSettings = {
    talkSec: clampSec(next.talkSec),
    challengeSec: clampSec(next.challengeSec),
  }
  localStorage.setItem(KEY, JSON.stringify(payload))
  return payload
}

export { MIN_SEC, MAX_SEC, DEFAULTS as DEFAULT_SETTINGS }
