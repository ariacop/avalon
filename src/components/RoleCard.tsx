import { ROLES, type RoleId } from '../data/roles'

export const ROLE_PORTRAITS: Partial<Record<RoleId, string>> = {
  merlin: '/roles/role-merlin.jpg',
  percival: '/roles/role-percival.jpg',
  servant: '/roles/role-servant.jpg',
  assassin: '/roles/role-assassin.jpg',
  morgana: '/roles/role-morgana.jpg',
  mordred: '/roles/role-mordred.jpg',
  oberon: '/roles/role-oberon.jpg',
  lover1: '/roles/role-lover.jpg',
  lover2: '/roles/role-lover.jpg',
}

const PORTRAITS = ROLE_PORTRAITS

interface Props {
  roleId: RoleId
  playerName?: string
  compact?: boolean
}

export function RoleCard({ roleId, playerName, compact = false }: Props) {
  const role = ROLES[roleId]
  const isGood = role.allegiance === 'good'
  const art = PORTRAITS[roleId]

  return (
    <article
      className={`role-card ${isGood ? 'role-card--good' : 'role-card--evil'} ${compact ? 'role-card--compact' : ''}`}
    >
      <div className="role-card__frame" aria-hidden>
        <span className="role-card__corner role-card__corner--tl" />
        <span className="role-card__corner role-card__corner--tr" />
        <span className="role-card__corner role-card__corner--bl" />
        <span className="role-card__corner role-card__corner--br" />
      </div>

      <div className="role-card__portrait">
        {art ? (
          <img src={art} alt="" draggable={false} />
        ) : (
          <div className="role-card__portrait-fallback" />
        )}
        <div className="role-card__portrait-veil" />
      </div>

      <div className="role-card__body">
        <p className={`role-card__side ${isGood ? 'is-good' : 'is-evil'}`}>
          {isGood ? 'شهر' : 'مافیا'} · {role.nickname}
        </p>
        {playerName && <p className="role-card__player">{playerName}</p>}
        <h2 className="role-card__name">{role.name}</h2>
        <p className="role-card__title">{role.title}</p>
        <p className="role-card__summary">{role.summary}</p>
        {!compact && <p className="role-card__lore">{role.lore}</p>}
        <p className="role-card__tip">{role.ability}</p>
      </div>
    </article>
  )
}
