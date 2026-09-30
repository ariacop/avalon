import { TEAM_SIZES } from '../data/setups'
import type { GameState, MissionOutcome, Phase, VoteChoice } from './game'

const PLAYERS_KEY = 'avalon-saved-players'
const GAME_KEY = 'avalon-active-game'

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
  } catch {
    // Storage unavailable (private mode); nothing to migrate.
  }
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
    const raw = localStorage.getItem(PLAYERS_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as SavedPlayers
    if (
      !data ||
      typeof data.count !== 'number' ||
      !Array.isArray(data.names) ||
      data.count < 5 ||
      data.count > 10
    ) {
      return null
    }
    return {
      count: data.count,
      names: data.names.map((n) => String(n ?? '')),
    }
  } catch {
    return null
  }
}

export function savePlayers(count: number, names: string[]) {
  const payload: SavedPlayers = {
    count,
    names: names.map((n) => n.trim()),
  }
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(payload))
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
    if (screen === 'reveal' || screen === 'ended') return screen
    return 'reveal'
  }
  if (game.phase === 'deal') return 'deal'

  switch (screen) {
    case 'lobby':
    case 'abilities':
    case 'vote-setup':
    case 'vote':
    case 'vote-result':
    case 'end-confirm':
    case 'timer':
    case 'settings':
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
  if (
    Array.isArray(game.missionSizes) &&
    game.missionSizes.length === 5 &&
    game.missionSizes.every((n) => typeof n === 'number')
  ) {
    return game
  }
  const fallback = TEAM_SIZES[game.playerCount] ?? [2, 3, 2, 3, 3]
  return { ...game, missionSizes: [...fallback] }
}

export function loadActiveSession(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(GAME_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<ActiveSession>
    if (!data || !isGameState(data.game)) {
      localStorage.removeItem(GAME_KEY)
      return null
    }
    const game = ensureMissionSizes(data.game)
    const screen =
      typeof data.screen === 'string'
        ? resumeScreenFor(game, data.screen)
        : resumeScreenFor(game, 'lobby')
    const inqUntil =
      typeof data.inqUntil === 'number' && data.inqUntil > Date.now()
        ? data.inqUntil
        : 0
    return { game, screen, inqUntil }
  } catch {
    return null
  }
}

export function saveActiveSession(session: ActiveSession) {
  localStorage.setItem(
    GAME_KEY,
    JSON.stringify({
      game: session.game,
      screen: session.screen,
      inqUntil: session.inqUntil,
    }),
  )
}

export function clearActiveSession() {
  localStorage.removeItem(GAME_KEY)
}
