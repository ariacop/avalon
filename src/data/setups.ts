import { ROLES, type RoleId } from './roles'

/**
 * Automatic role pools — aligned with common Persian Avalon helpers
 * (e.g. https://rozup.ir/view/4300442/Avalon.html) and rulebook side counts:
 * 5→3/2 · 6→4/2 · 7→4/3 · 8→5/3 · 9→6/3 · 10→6/4
 *
 * Note: 7–8 use Mordred (no Oberon). Oberon only at 10. Lovers at 9–10.
 */
export const SETUPS: Record<number, RoleId[]> = {
  5: ['merlin', 'percival', 'servant', 'assassin', 'morgana'],
  6: ['merlin', 'percival', 'servant', 'servant', 'assassin', 'morgana'],
  7: [
    'merlin',
    'percival',
    'servant',
    'servant',
    'mordred',
    'assassin',
    'morgana',
  ],
  8: [
    'merlin',
    'percival',
    'servant',
    'servant',
    'servant',
    'mordred',
    'assassin',
    'morgana',
  ],
  9: [
    'merlin',
    'percival',
    'servant',
    'servant',
    'lover1',
    'lover2',
    'mordred',
    'assassin',
    'morgana',
  ],
  10: [
    'merlin',
    'percival',
    'servant',
    'servant',
    'lover1',
    'lover2',
    'mordred',
    'assassin',
    'morgana',
    'oberon',
  ],
}

/** Rulebook resistance/spy counts by player count. */
export const SIDE_COUNTS: Record<number, { good: number; evil: number }> = {
  5: { good: 3, evil: 2 },
  6: { good: 4, evil: 2 },
  7: { good: 4, evil: 3 },
  8: { good: 5, evil: 3 },
  9: { good: 6, evil: 3 },
  10: { good: 6, evil: 4 },
}

export const TEAM_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
}

/** Mission 4 needs 2 fails when 7+ players. */
export function needsTwoFails(playerCount: number, missionIndex: number): boolean {
  return playerCount >= 7 && missionIndex === 3
}

export function countSides(roles: RoleId[]) {
  let good = 0
  let evil = 0
  for (const id of roles) {
    if (ROLES[id].allegiance === 'good') good++
    else evil++
  }
  return { good, evil }
}

export function roleNamesList(playerCount: number): { good: string[]; evil: string[] } {
  const roles = SETUPS[playerCount] ?? []
  const good: string[] = []
  const evil: string[] = []
  for (const id of roles) {
    const r = ROLES[id]
    if (r.allegiance === 'good') good.push(r.name)
    else evil.push(r.name)
  }
  return { good, evil }
}
