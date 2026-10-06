import { useEffect, useMemo, useRef, useState } from 'react'
import type { Player } from '../lib/game'

type Phase = 'confirm' | 'spinning' | 'done'

interface LeaderWheelProps {
  players: Player[]
  inquiryEnabled: boolean
  leaderId: string
  firstInquirerId: string | null
  onCancel: () => void
  onFinished: () => void
}

const SPIN_MS = 4200

export function LeaderWheel({
  players,
  inquiryEnabled,
  leaderId,
  firstInquirerId,
  onCancel,
  onFinished,
}: LeaderWheelProps) {
  const [phase, setPhase] = useState<Phase>('confirm')
  const [rotation, setRotation] = useState(0)
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null)
  const tickRef = useRef<number | null>(null)

  const leaderIndex = useMemo(
    () => Math.max(0, players.findIndex((p) => p.id === leaderId)),
    [players, leaderId],
  )
  const firstInquirer = useMemo(
    () => players.find((p) => p.id === firstInquirerId) ?? null,
    [players, firstInquirerId],
  )
  const leader = players[leaderIndex] ?? null
  const n = players.length
  const step = 360 / Math.max(n, 1)

  const targetAngle = useMemo(
    () => 360 * 5 + leaderIndex * step,
    [leaderIndex, step],
  )

  function startSpin() {
    if (phase !== 'confirm') return
    setPhase('spinning')
    // Next frame so CSS transition catches the target rotation.
    window.requestAnimationFrame(() => setRotation(targetAngle))
  }

  useEffect(() => {
    if (phase !== 'spinning') return

    const started = performance.now()
    const tick = () => {
      const t = Math.min(1, (performance.now() - started) / SPIN_MS)
      const eased = 1 - Math.pow(1 - t, 3)
      const angle = eased * targetAngle
      const idx = Math.round((angle % 360) / step) % n
      setHighlightIndex(idx)
      if (t < 1) {
        tickRef.current = window.requestAnimationFrame(tick)
      }
    }
    tickRef.current = window.requestAnimationFrame(tick)

    const end = window.setTimeout(() => {
      setHighlightIndex(leaderIndex)
      setPhase('done')
    }, SPIN_MS + 80)

    return () => {
      if (tickRef.current != null) window.cancelAnimationFrame(tickRef.current)
      window.clearTimeout(end)
    }
  }, [phase, targetAngle, step, n, leaderIndex])

  const leadText =
    phase === 'confirm'
      ? 'میز آماده است. وقتی همه جمع‌اند، چرخش را شروع کنید.'
      : phase === 'done'
        ? 'لیدر اول مشخص شد.'
        : 'عقربه روی میز می‌چرخد تا لیدر را انتخاب کند…'

  return (
    <section className={`screen leader-spin fade-in ${phase === 'done' ? 'is-done' : ''}`}>
      <header className="topbar">
        <button className="link" onClick={onCancel} type="button">
          لابی
        </button>
        <h2>انتخاب لیدر</h2>
        <span />
      </header>

      <p className="lead">{leadText}</p>

      <div
        className={`table-spin ${phase === 'spinning' ? 'is-busy' : ''}`}
        aria-live="polite"
      >
        <div className="table-spin__wood" aria-hidden>
          <div className="table-spin__ring" />
          <div className="table-spin__core" />
          <div className="table-spin__rune" />
        </div>

        <div
          className={`table-spin__needle ${phase === 'spinning' ? 'is-spinning' : ''} ${
            phase === 'done' ? 'is-done' : ''
          }`}
          style={{
            transform: `rotate(${rotation}deg)`,
            transition:
              phase === 'spinning'
                ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.75, 0.12, 1)`
                : 'none',
          }}
          aria-hidden
        >
          <span className="table-spin__arm" />
          <span className="table-spin__hub" />
        </div>

        {players.map((p, i) => {
          const angle = i * step
          const isHi =
            highlightIndex === i || (phase === 'done' && i === leaderIndex)
          const isLeader = phase === 'done' && i === leaderIndex
          return (
            <div
              key={p.id}
              className={`table-spin__seat ${isHi ? 'is-hot' : ''} ${
                isLeader ? 'is-leader' : ''
              }`}
              style={{
                transform: `rotate(${angle}deg) translateY(calc(-1 * var(--orbit))) rotate(${-angle}deg)`,
              }}
            >
              <span className="table-spin__name">{p.name}</span>
            </div>
          )
        })}
      </div>

      {phase === 'confirm' && (
        <div className="leader-confirm">
          <button className="btn btn--primary" onClick={startSpin}>
            شروع چرخش
          </button>
          <button className="btn btn--ghost" onClick={onCancel}>
            انصراف
          </button>
        </div>
      )}

      {phase === 'done' && leader && (
        <div className="leader-result fade-in">
          <div className="leader-result__cards">
            <div className="leader-result__card is-leader">
              <p className="leader-result__label">لیدر اول</p>
              <p className="leader-result__name">{leader.name}</p>
            </div>
            {inquiryEnabled && firstInquirer && (
              <div className="leader-result__card is-inq">
                <p className="leader-result__label">اولین استعلام</p>
                <p className="leader-result__name">{firstInquirer.name}</p>
              </div>
            )}
          </div>
          {!inquiryEnabled && (
            <p className="hint muted">استعلام در تنظیمات خاموش است.</p>
          )}
          <button className="btn btn--primary" onClick={onFinished}>
            بازگشت به لابی
          </button>
        </div>
      )}
    </section>
  )
}
