import { ROLES, type RoleId } from '../data/roles'
import { SETUPS, TEAM_SIZES, needsTwoFails } from '../data/setups'

export type Phase = 'deal' | 'play' | 'ended'
export type VoteChoice = 'pass' | 'fail'
export type MissionOutcome = 'pending' | 'success' | 'fail'

export interface Player {
  id: string
  name: string
  roleId: RoleId | null
  slot: number | null
  revealed: boolean
  abilitySeen: boolean
}

export interface RoleSlot {
  number: number
  roleId: RoleId
  takenBy: string | null
}

export interface VoteSlot {
  number: number
  vote: VoteChoice | null
}

export interface VoteRound {
  missionIndex: number
  teamSize: number
  slots: VoteSlot[]
  revealed: boolean
}

export interface GameState {
  phase: Phase
  players: Player[]
  slots: RoleSlot[]
  playerCount: number
  missions: MissionOutcome[]
  /** Team size under each mission — updated from the vote size. */
  missionSizes?: number[]
  currentMission: number
  vote: VoteRound | null
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function createGame(names: string[]): GameState {
  const count = names.length
  const setup = SETUPS[count]
  if (!setup) throw new Error('تعداد بازیکن باید بین ۵ تا ۱۰ باشد')

  const roles = shuffle(setup)
  const slots: RoleSlot[] = roles.map((roleId, i) => ({
    number: i + 1,
    roleId,
    takenBy: null,
  }))

  const players: Player[] = names.map((name, i) => ({
    id: `p-${i}-${Date.now()}`,
    name: name.trim(),
    roleId: null,
    slot: null,
    revealed: false,
    abilitySeen: false,
  }))

  return {
    phase: 'deal',
    players,
    slots,
    playerCount: count,
    missions: Array.from({ length: 5 }, () => 'pending'),
    missionSizes: [...(TEAM_SIZES[count] ?? [2, 3, 2, 3, 3])],
    currentMission: 0,
    vote: null,
  }
}

export function allRolesDealt(game: GameState): boolean {
  return game.players.every((p) => p.revealed && p.roleId)
}

export function claimRoleSlot(
  game: GameState,
  playerId: string,
  slotNumber: number,
): GameState | { error: string } {
  if (game.phase !== 'deal') return { error: 'مرحلهٔ پخش نقش تمام شده.' }

  const player = game.players.find((p) => p.id === playerId)
  if (!player) return { error: 'بازیکن پیدا نشد.' }
  if (player.revealed) return { error: 'این بازیکن قبلاً نقش دیده.' }

  const slot = game.slots.find((s) => s.number === slotNumber)
  if (!slot) return { error: 'این عدد وجود ندارد.' }
  if (slot.takenBy) return { error: 'این عدد قبلاً انتخاب شده.' }

  const next: GameState = {
    ...game,
    slots: game.slots.map((s) =>
      s.number === slotNumber ? { ...s, takenBy: playerId } : s,
    ),
    players: game.players.map((p) =>
      p.id === playerId
        ? { ...p, roleId: slot.roleId, slot: slotNumber, revealed: true }
        : p,
    ),
  }

  if (allRolesDealt(next)) {
    return { ...next, phase: 'play' }
  }
  return next
}

export function markAbilitySeen(
  game: GameState,
  playerId: string,
): GameState {
  return {
    ...game,
    players: game.players.map((p) =>
      p.id === playerId ? { ...p, abilitySeen: true } : p,
    ),
  }
}

export interface InquiryEntry {
  name: string
  detail?: string
}

export interface InquiryResult {
  title: string
  subtitle: string
  entries: InquiryEntry[]
  emptyMessage?: string
}

export function inquire(viewer: Player, all: Player[]): InquiryResult | null {
  if (!viewer.roleId) return null
  const role = ROLES[viewer.roleId]
  if (!role.canInquire) return null

  const others = all.filter((p) => p.id !== viewer.id && p.roleId)

  switch (viewer.roleId) {
    case 'merlin': {
      const hasMordred = all.some((p) => p.roleId === 'mordred')
      const seen = others.filter((p) => {
        const r = ROLES[p.roleId!]
        return r.allegiance === 'evil' && p.roleId !== 'mordred'
      })
      return {
        title: 'مافیاهایی که می‌بینی',
        subtitle: hasMordred
          ? 'این‌ها مافیا هستند — موردرد (پدرخوانده) اینجا نیست'
          : 'این‌ها مافیا هستند',
        entries: shuffle(seen.map((p) => ({ name: p.name }))),
        emptyMessage: 'کسی را نمی‌بینی.',
      }
    }
    case 'percival': {
      const seen = others.filter(
        (p) => p.roleId === 'merlin' || p.roleId === 'morgana',
      )
      return {
        title: 'دو نفر مشکوک',
        subtitle: 'یکی مرلین است، یکی مورگانا — نمی‌دانی کدام',
        entries: shuffle(seen.map((p) => ({ name: p.name }))),
      }
    }
    case 'lover1': {
      const seen = others.filter((p) => p.roleId === 'lover2')
      return {
        title: 'جفت تو',
        subtitle: 'لاور دوم',
        entries: seen.map((p) => ({ name: p.name })),
        emptyMessage: 'پیدا نشد.',
      }
    }
    case 'lover2': {
      const seen = others.filter((p) => p.roleId === 'lover1')
      return {
        title: 'جفت تو',
        subtitle: 'لاور اول',
        entries: seen.map((p) => ({ name: p.name })),
        emptyMessage: 'پیدا نشد.',
      }
    }
    case 'assassin':
    case 'morgana':
    case 'mordred': {
      const hasOberon = all.some((p) => p.roleId === 'oberon')
      const seen = others.filter((p) => {
        const r = ROLES[p.roleId!]
        return r.allegiance === 'evil' && p.roleId !== 'oberon'
      })
      return {
        title: 'یارهای مافیا',
        subtitle: hasOberon
          ? 'اسم و نقش هم‌تیمی‌ها (اوبرون اینجا نیست)'
          : 'اسم و نقش هم‌تیمی‌هایت',
        entries: shuffle(
          seen.map((p) => ({
            name: p.name,
            detail: `${ROLES[p.roleId!].name} · ${ROLES[p.roleId!].nickname}`,
          })),
        ),
        emptyMessage: 'یار دیگری نداری.',
      }
    }
    default:
      return null
  }
}

export function privateView(viewer: Player, all: Player[]) {
  if (!viewer.roleId) return null
  const role = ROLES[viewer.roleId]
  const vision = inquire(viewer, all)
  return { role, vision }
}

export function startVote(
  game: GameState,
  teamSize: number,
): GameState | { error: string } {
  if (game.phase !== 'play') return { error: 'الان نمی‌شود رأی داد.' }
  if (game.vote && !game.vote.revealed) {
    return { error: 'رأی‌گیری فعلی هنوز تمام نشده.' }
  }
  if (teamSize < 2 || teamSize > 5) return { error: 'تعداد رأی باید ۲ تا ۵ باشد.' }

  const missionIndex =
    game.missions.findIndex((m) => m === 'pending') === -1
      ? game.currentMission
      : game.missions.findIndex((m) => m === 'pending')

  const idx = missionIndex >= 0 ? missionIndex : game.currentMission
  const missionSizes = [...(game.missionSizes ?? TEAM_SIZES[game.playerCount] ?? [])]
  while (missionSizes.length < 5) missionSizes.push(teamSize)
  if (idx >= 0 && idx < missionSizes.length) {
    missionSizes[idx] = teamSize
  }

  return {
    ...game,
    currentMission: idx,
    missionSizes,
    vote: {
      missionIndex: idx,
      teamSize,
      slots: Array.from({ length: teamSize }, (_, i) => ({
        number: i + 1,
        vote: null,
      })),
      revealed: false,
    },
  }
}

export function castVote(
  game: GameState,
  slotNumber: number,
  choice: VoteChoice,
): GameState | { error: string } {
  if (!game.vote || game.vote.revealed) {
    return { error: 'رأی‌گیری فعال نیست.' }
  }
  const slot = game.vote.slots.find((s) => s.number === slotNumber)
  if (!slot) return { error: 'این عدد وجود ندارد.' }
  if (slot.vote) return { error: 'این عدد قبلاً رأی داده.' }

  return {
    ...game,
    vote: {
      ...game.vote,
      slots: game.vote.slots.map((s) =>
        s.number === slotNumber ? { ...s, vote: choice } : s,
      ),
    },
  }
}

export function allVotesIn(game: GameState): boolean {
  return Boolean(game.vote && game.vote.slots.every((s) => s.vote))
}

export interface VoteTally {
  pass: number
  fail: number
  success: boolean
  failsNeeded: number
}

export function tallyVote(game: GameState): VoteTally | null {
  if (!game.vote || !allVotesIn(game)) return null
  const pass = game.vote.slots.filter((s) => s.vote === 'pass').length
  const fail = game.vote.slots.filter((s) => s.vote === 'fail').length
  const failsNeeded = needsTwoFails(game.playerCount, game.vote.missionIndex)
    ? 2
    : 1
  return {
    pass,
    fail,
    failsNeeded,
    success: fail < failsNeeded,
  }
}

export function revealVote(game: GameState): GameState | { error: string } {
  if (!game.vote) return { error: 'رأی‌گیری‌ای نیست.' }
  if (!allVotesIn(game)) return { error: 'هنوز همه رأی نداده‌اند.' }
  return { ...game, vote: { ...game.vote, revealed: true } }
}

export function finishVoteAndAdvance(
  game: GameState,
): GameState | { error: string } {
  const tally = tallyVote(game)
  if (!game.vote || !game.vote.revealed || !tally) {
    return { error: 'نتیجه هنوز آماده نیست.' }
  }

  const missions = [...game.missions]
  const idx = game.vote.missionIndex
  if (idx >= 0 && idx < missions.length) {
    missions[idx] = tally.success ? 'success' : 'fail'
  }

  const nextPending = missions.findIndex((m) => m === 'pending')

  return {
    ...game,
    missions,
    currentMission: nextPending === -1 ? game.currentMission : nextPending,
    vote: null,
    phase: 'play',
  }
}

export function endGameReveal(game: GameState): GameState {
  return { ...game, phase: 'ended', vote: null }
}

export function missionSummary(game: GameState) {
  const success = game.missions.filter((m) => m === 'success').length
  const fail = game.missions.filter((m) => m === 'fail').length
  return { success, fail }
}
