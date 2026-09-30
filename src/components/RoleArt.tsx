import type { RoleId } from '../data/roles'

interface Props {
  roleId: RoleId
  className?: string
}

export function RoleArt({ roleId, className = '' }: Props) {
  return (
    <div className={`role-art ${className}`} aria-hidden>
      {artFor(roleId)}
    </div>
  )
}

function artFor(id: RoleId) {
  switch (id) {
    case 'merlin':
      return (
        <svg viewBox="0 0 200 200" fill="none">
          <defs>
            <radialGradient id="m-glow" cx="50%" cy="40%" r="50%">
              <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="80" fill="url(#m-glow)" />
          <path
            d="M100 30c-8 18-28 28-42 34 10 4 22 18 26 36 2-14 10-26 16-34 6 8 14 20 16 34 4-18 16-32 26-36-14-6-34-16-42-34z"
            fill="#c4b5fd"
            opacity="0.9"
          />
          <circle cx="100" cy="118" r="22" fill="#e0e7ff" />
          <path
            d="M78 118c0 20 10 36 22 42 12-6 22-22 22-42"
            stroke="#a78bfa"
            strokeWidth="3"
            fill="none"
          />
          <path
            d="M70 155c10 18 30 28 30 28s20-10 30-28"
            stroke="#93c5fd"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="100" cy="52" r="5" fill="#fef08a" />
        </svg>
      )
    case 'percival':
      return (
        <svg viewBox="0 0 200 200" fill="none">
          <path
            d="M100 28 L130 48 L130 95 C130 130 100 155 100 168 C100 155 70 130 70 95 L70 48 Z"
            fill="#bfdbfe"
            stroke="#1e3a5f"
            strokeWidth="3"
          />
          <path
            d="M100 40 L118 52 L118 92 C118 118 100 138 100 148 C100 138 82 118 82 92 L82 52 Z"
            fill="#eff6ff"
          />
          <path d="M88 70h24M94 88h12" stroke="#1d4ed8" strokeWidth="2.5" />
          <circle cx="100" cy="58" r="4" fill="#fbbf24" />
        </svg>
      )
    case 'servant':
      return (
        <svg viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="72" r="28" fill="#fde68a" stroke="#92400e" strokeWidth="3" />
          <path
            d="M55 168c8-36 28-52 45-52s37 16 45 52"
            fill="#fef3c7"
            stroke="#92400e"
            strokeWidth="3"
          />
          <path
            d="M72 95c8 10 18 14 28 14s20-4 28-14"
            stroke="#b45309"
            strokeWidth="2.5"
            fill="none"
          />
          <path d="M100 48v-14M92 40l8-8 8 8" stroke="#b45309" strokeWidth="2.5" fill="none" />
        </svg>
      )
    case 'assassin':
      return (
        <svg viewBox="0 0 200 200" fill="none">
          <path
            d="M108 30 L118 120 L100 170 L82 120 L92 30 Z"
            fill="#fecaca"
            stroke="#7f1d1d"
            strokeWidth="2.5"
          />
          <path d="M92 30h16l-2 14H94z" fill="#fef2f2" />
          <path d="M78 118h44" stroke="#991b1b" strokeWidth="6" strokeLinecap="round" />
          <path d="M70 118h60" stroke="#450a0a" strokeWidth="2" />
          <circle cx="100" cy="100" r="3" fill="#7f1d1d" />
        </svg>
      )
    case 'morgana':
      return (
        <svg viewBox="0 0 200 200" fill="none">
          <defs>
            <radialGradient id="mo-glow" cx="50%" cy="45%" r="45%">
              <stop offset="0%" stopColor="#f0abfc" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#f0abfc" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="78" fill="url(#mo-glow)" />
          <path
            d="M60 70c20-30 60-30 80 0-8 8-12 20-12 34 0 28-16 48-28 58-12-10-28-30-28-58 0-14-4-26-12-34z"
            fill="#e9d5ff"
            stroke="#6b21a8"
            strokeWidth="2.5"
          />
          <path d="M88 95c4 8 12 12 20 0" stroke="#86198f" strokeWidth="2" fill="none" />
          <circle cx="86" cy="88" r="3" fill="#4c1d95" />
          <circle cx="114" cy="88" r="3" fill="#4c1d95" />
          <path d="M70 48c10 6 20 4 30-2 10 6 20 8 30 2" stroke="#c026d3" strokeWidth="2" fill="none" />
        </svg>
      )
    case 'mordred':
      return (
        <svg viewBox="0 0 200 200" fill="none">
          <path
            d="M100 36 L140 56 L148 100 L120 150 L80 150 L52 100 L60 56 Z"
            fill="#1f2937"
            stroke="#fbbf24"
            strokeWidth="3"
          />
          <path
            d="M100 52 L128 66 L134 100 L112 138 L88 138 L66 100 L72 66 Z"
            fill="#111827"
          />
          <path d="M78 92h44M86 110h28" stroke="#f59e0b" strokeWidth="2.5" />
          <circle cx="100" cy="78" r="5" fill="#fbbf24" />
        </svg>
      )
    case 'oberon':
      return (
        <svg viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="70" stroke="#64748b" strokeWidth="2" strokeDasharray="4 6" opacity="0.5" />
          <path
            d="M100 48c-22 0-40 16-40 40 0 28 20 44 40 64 20-20 40-36 40-64 0-24-18-40-40-40z"
            fill="#334155"
            stroke="#94a3b8"
            strokeWidth="2.5"
          />
          <circle cx="88" cy="88" r="4" fill="#cbd5e1" />
          <circle cx="112" cy="88" r="4" fill="#cbd5e1" />
          <path d="M90 108c6 6 14 6 20 0" stroke="#94a3b8" strokeWidth="2" fill="none" />
          <path d="M100 40v-12M100 172v-12M40 100h-12M172 100h-12" stroke="#64748b" strokeWidth="2" opacity="0.6" />
        </svg>
      )
    case 'lover1':
    case 'lover2':
      return (
        <svg viewBox="0 0 200 200" fill="none">
          <path
            d="M70 88c0-14 10-24 22-24 8 0 14 4 18 10 4-6 10-10 18-10 12 0 22 10 22 24 0 28-40 52-40 52S70 116 70 88z"
            fill="#fda4af"
            stroke="#9f1239"
            strokeWidth="2.5"
          />
          <circle cx="78" cy="70" r="16" fill="#fecdd3" stroke="#9f1239" strokeWidth="2" />
          <circle cx="122" cy="70" r="16" fill="#fecdd3" stroke="#9f1239" strokeWidth="2" />
          <path
            d={
              id === 'lover1'
                ? 'M100 118v28M92 138h16'
                : 'M92 130c6 8 10 8 16 0'
            }
            stroke="#9f1239"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      )
  }
}
