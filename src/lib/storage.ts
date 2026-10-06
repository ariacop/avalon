import { TEAM_SIZES } from '../data/setups'
import type { GameState, MissionOutcome, Phase, VoteChoice } from './game'
import { sanitizeInquiryState } from './game'
import { readSealedJson, writeSealedJson } from './seal'

const PLAYERS_KEY = 'avalon-saved-players'
const GAME_KEY = 'avalon-active-game'
const SETTINGS_KEY = 'avalon-settings'

const RENAMED_KEYS = ['saved-players', 'active-game', 'settings']

/** Carry data saved under the old misspelled `avelon-*` keys over to `avalon-*`. */
export function migrateStorageKeys() {
  try {
    for (const k of RENAMED_KEYS) {
      const old = localStorage.getItem(`avelon-${k}`)
      if (old === null) continue
      if (localStorage.getItem(`avalon-${k}`) === null) {
        localStorage.setItem(`avalon-${k}`, old)
      }
      localStorage.removeItem(`avelon-${k}`)
    }
    // Re-seal any still-plain JSON under the current keys.
    resealIfLegacy(PLAYERS_KEY)
    resealIfLegacy(GAME_KEY)
    resealIfLegacy(SETTINGS_KEY)
  } catch {
    // Storage unavailable (private mode); nothing to migrate.
  }
}

function resealIfLegacy(key: string) {
  const opened = readSealedJson<unknown>(key)
  if (opened?.legacy) writeSealedJson(key, opened.value)
}

export interface SavedPlayers {
  count: number
  names: string[]
}

export interface ActiveSession {
  game: GameState
  screen: string
  inqUntil: number
}

export function loadSavedPlayers(): SavedPlayers | null {
  try {
    const opened = readSealedJson<SavedPlayers>(PLAYERS_KEY)
    if (!opened) return null
    const data = opened.value
    if (
      !data ||
      typeof data.count !== 'number' ||
      !Array.isArray(data.names) ||
      data.count < 5 ||
      data.count > 10
    ) {
      return null
    }
    const saved: SavedPlayers = {
      count: data.count,
      names: data.names.map((n) => String(n ?? '')),
    }
    if (opened.legacy) writeSealedJson(PLAYERS_KEY, saved)
    return saved
  } catch {
    return null
  }
}

export function savePlayers(count: number, names: string[]) {
  const payload: SavedPlayers = {
    count,
    names: names.map((n) => n.trim()),
  }
  writeSealedJson(PLAYERS_KEY, payload)
}

function isPhase(v: unknown): v is Phase {
  return v === 'deal' || v === 'play' || v === 'ended'
}

function isMission(v: unknown): v is MissionOutcome {
  return v === 'pending' || v === 'success' || v === 'fail'
}

function isVoteChoice(v: unknown): v is VoteChoice {
  return v === 'pass' || v === 'fail'
}

function isGameState(data: unknown): data is GameState {
  if (!data || typeof data !== 'object') return false
  const g = data as Record<string, unknown>
  if (!isPhase(g.phase)) return false
  if (!Array.isArray(g.players) || g.players.length < 5 || g.players.length > 10) {
    return false
  }
  if (!Array.isArray(g.slots) || g.slots.length !== g.players.length) return false
  if (typeof g.playerCount !== 'number' || g.playerCount !== g.players.length) {
    return false
  }
  if (!Array.isArray(g.missions) || g.missions.length !== 5) return false
  if (!g.missions.every(isMission)) return false
  if (typeof g.currentMission !== 'number') return false
  // Optional for older sessions — App/game fills from TEAM_SIZES when missing.
  if (g.missionSizes != null) {
    if (!Array.isArray(g.missionSizes) || g.missionSizes.length !== 5) return false
    if (!g.missionSizes.every((n) => typeof n === 'number' && n >= 2 && n <= 5)) {
      return false
    }
  }
  if (g.vote != null) {
    if (typeof g.vote !== 'object') return false
    const vote = g.vote as Record<string, unknown>
    if (typeof vote.missionIndex !== 'number') return false
    if (typeof vote.teamSize !== 'number') return false
    if (typeof vote.revealed !== 'boolean') return false
    if (!Array.isArray(vote.slots)) return false
    for (const slot of vote.slots) {
      if (!slot || typeof slot !== 'object') return false
      const s = slot as Record<string, unknown>
      if (typeof s.number !== 'number') return false
      if (s.vote != null && !isVoteChoice(s.vote)) return false
    }
  }
  return true
}

/** Safe screen to reopen after refresh — never leave a private reveal open. */
export function resumeScreenFor(game: GameState, screen: string): string {
  if (game.phase === 'ended') {
    if (
      screen === 'reveal' ||
      screen === 'ended' ||
      screen === 'climax-evil' ||
      screen === 'assassin-result'
    ) {
      return screen
    }
    return 'reveal'
  }
  if (game.phase === 'deal') return 'deal'

  switch (screen) {
    case 'lobby':
    case 'abilities':
    case 'vote-setup':
    case 'vote':
    case 'vote-result':
    case 'climax-evil':
    case 'assassin-intro':
    case 'assassin-pick':
    case 'assassin-confirm':
    case 'assassin-result':
    case 'end-confirm':
    case 'timer':
    case 'settings':
    case 'leader-spin':
      return screen
    case 'vote-cast':
    case 'vote-confirm':
      return game.vote && !game.vote.revealed ? 'vote' : 'lobby'
    case 'ability-confirm':
    case 'ability-view':
      return 'abilities'
    case 'inq-pick':
    case 'inq-confirm':
    case 'inq-flip':
    case 'inq-result':
      return 'lobby'
    default:
      if (game.vote && !game.vote.revealed) return 'vote'
      if (game.vote?.revealed) return 'vote-result'
      return 'lobby'
  }
}

function ensureMissionSizes(game: GameState): GameState {
  let next = game
  if (
    !(
      Array.isArray(game.missionSizes) &&
      game.missionSizes.length === 5 &&
      game.missionSizes.every((n) => typeof n === 'number')
    )
  ) {
    const fallback = TEAM_SIZES[game.playerCount] ?? [2, 3, 2, 3, 3]
    next = { ...next, missionSizes: [...fallback] }
  }

  // Older saves never had a leader ceremony — skip it if play already began.
  if (
    next.phase === 'play' &&
    !next.leaderChosen &&
    (next.vote != null || next.missions.some((m) => m !== 'pending'))
  ) {
    next = { ...next, leaderChosen: true }
  }

  return next
}

function prepareLoadedGame(game: GameState): GameState {
  return sanitizeInquiryState(ensureMissionSizes(game))
}

export function loadActiveSession(): ActiveSession | null {
  try {
    const opened = readSealedJson<Partial<ActiveSession>>(GAME_KEY)
    if (!opened) return null
    const data = opened.value
    if (!data || !isGameState(data.game)) {
      localStorage.removeItem(GAME_KEY)
      return null
    }
    const game = prepareLoadedGame(data.game)
    const screen =
      typeof data.screen === 'string'
        ? resumeScreenFor(game, data.screen)
        : resumeScreenFor(game, 'lobby')
    const inqUntil =
      typeof data.inqUntil === 'number' && data.inqUntil > Date.now()
        ? data.inqUntil
        : 0
    const session: ActiveSession = { game, screen, inqUntil }
    if (opened.legacy) writeSealedJson(GAME_KEY, session)
    return session
  } catch {
    return null
  }
}

export function saveActiveSession(session: ActiveSession) {
  writeSealedJson(GAME_KEY, {
    game: session.game,
    screen: session.screen,
    inqUntil: session.inqUntil,
  })
}

export function clearActiveSession() {
  localStorage.removeItem(GAME_KEY)
}
