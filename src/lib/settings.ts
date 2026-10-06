import { readSealedJson, writeSealedJson } from './seal'

const KEY = 'avalon-settings'

export type FirstInquirerMode = 'random' | 'rightOfLeader'

/** Map fullscreen backgrounds under /public. Index 0 keeps the user's map-bg.jpg. */
export const MAP_BACKGROUNDS = [
  '/map-bg.jpg',
  '/map-bg-2.jpg',
  '/map-bg-3.jpg',
] as const

export type MapBgIndex = 0 | 1 | 2

export interface AppSettings {
  talkSec: number
  challengeSec: number
  /** Side-inquiry feature during play. Default: on. */
  inquiryEnabled: boolean
  /** Who gets the first inquiry after the leader is chosen. */
  firstInquirerMode: FirstInquirerMode
  /** Which world-map art to show on the mission map. */
  mapBg: MapBgIndex
}

const DEFAULTS: AppSettings = {
  talkSec: 60,
  challengeSec: 30,
  inquiryEnabled: true,
  firstInquirerMode: 'rightOfLeader',
  mapBg: 0,
}

const MIN_SEC = 10
const MAX_SEC = 300

function clampSec(n: number): number {
  if (!Number.isFinite(n)) return MIN_SEC
  return Math.min(MAX_SEC, Math.max(MIN_SEC, Math.round(n)))
}

function isFirstInquirerMode(v: unknown): v is FirstInquirerMode {
  return v === 'random' || v === 'rightOfLeader'
}

function normalize(data: Partial<AppSettings>): AppSettings {
  const talkSec = clampSec(
    typeof data.talkSec === 'number' ? data.talkSec : DEFAULTS.talkSec,
  )
  const challengeSec = clampSec(
    typeof data.challengeSec === 'number'
      ? data.challengeSec
      : Math.max(MIN_SEC, Math.round(talkSec / 2)),
  )
  const inquiryEnabled =
    typeof data.inquiryEnabled === 'boolean'
      ? data.inquiryEnabled
      : DEFAULTS.inquiryEnabled
  const firstInquirerMode = isFirstInquirerMode(data.firstInquirerMode)
    ? data.firstInquirerMode
    : DEFAULTS.firstInquirerMode
  const mapBgRaw =
    typeof data.mapBg === 'number' && Number.isInteger(data.mapBg)
      ? data.mapBg
      : DEFAULTS.mapBg
  const mapBg = (
    mapBgRaw >= 0 && mapBgRaw < MAP_BACKGROUNDS.length
      ? mapBgRaw
      : DEFAULTS.mapBg
  ) as MapBgIndex
  return { talkSec, challengeSec, inquiryEnabled, firstInquirerMode, mapBg }
}

export function loadSettings(): AppSettings {
  try {
    const opened = readSealedJson<Partial<AppSettings>>(KEY)
    if (!opened) return { ...DEFAULTS }
    const settings = normalize(opened.value)
    if (opened.legacy) writeSealedJson(KEY, settings)
    return settings
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(next: AppSettings) {
  const payload = normalize(next)
  writeSealedJson(KEY, payload)
  return payload
}

export { MIN_SEC, MAX_SEC, DEFAULTS as DEFAULT_SETTINGS }
