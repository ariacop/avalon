import { useEffect, useMemo, useRef, useState } from 'react'
import { RoleCard, ROLE_PORTRAITS } from './components/RoleCard'
import { ROLES, type RoleId } from './data/roles'
import { TEAM_SIZES, roleNamesList, needsTwoFails } from './data/setups'
import {
  allVotesIn,
  castVote,
  claimRoleSlot,
  createGame,
  endGameReveal,
  finishVoteAndAdvance,
  markAbilitySeen,
  missionSummary,
  privateView,
  revealVote,
  shuffle,
  startVote,
  tallyVote,
  type GameState,
  type Player,
  type RoleSlot,
  type VoteChoice,
  type VoteSlot,
} from './lib/game'
import { playAlarmBeep } from './lib/beep'
import {
  loadSettings,
  saveSettings,
  MIN_SEC,
  MAX_SEC,
  type AppSettings,
} from './lib/settings'
import {
  clearActiveSession,
  loadActiveSession,
  loadSavedPlayers,
  saveActiveSession,
  savePlayers,
} from './lib/storage'

type Screen =
  | 'home'
  | 'setup'
  | 'deal'
  | 'deal-pick'
  | 'deal-role'
  | 'lobby'
  | 'abilities'
  | 'ability-confirm'
  | 'ability-view'
  | 'inq-pick'
  | 'inq-confirm'
  | 'inq-flip'
  | 'inq-result'
  | 'vote-setup'
  | 'vote'
  | 'vote-cast'
  | 'vote-confirm'
  | 'vote-result'
  | 'end-confirm'
  | 'reveal'
  | 'ended'
  | 'timer'
  | 'settings'

type TimerMode = 'talk' | 'challenge'

const SCREENS = new Set<Screen>([
  'home',
  'setup',
  'deal',
  'deal-pick',
  'deal-role',
  'lobby',
  'abilities',
  'ability-confirm',
  'ability-view',
  'inq-pick',
  'inq-confirm',
  'inq-flip',
  'inq-result',
  'vote-setup',
  'vote',
  'vote-cast',
  'vote-confirm',
  'vote-result',
  'end-confirm',
  'reveal',
  'ended',
  'timer',
  'settings',
])

const MIN = 5
const MAX = 10

function initialNames(): { count: number; names: string[] } {
  const saved = loadSavedPlayers()
  if (saved) {
    return {
      count: saved.count,
      names: Array.from({ length: saved.count }, (_, i) => saved.names[i] ?? ''),
    }
  }
  return { count: 7, names: Array.from({ length: 7 }, () => '') }
}

function bootFromStorage(): {
  screen: Screen
  game: GameState | null
  inqUntil: number
  votePad: VoteSlot[]
} {
  const session = loadActiveSession()
  if (!session) {
    return { screen: 'home', game: null, inqUntil: 0, votePad: [] }
  }
  const screen = SCREENS.has(session.screen as Screen)
    ? (session.screen as Screen)
    : session.game.phase === 'deal'
      ? 'deal'
      : 'lobby'
  return {
    screen,
    game: session.game,
    inqUntil: session.inqUntil,
    votePad:
      session.game.vote && (screen === 'vote' || screen === 'vote-result')
        ? shuffle([...session.game.vote.slots])
        : [],
  }
}

export default function App() {
  const boot = initialNames()
  const resumed = useMemo(() => bootFromStorage(), [])
  const [screen, setScreen] = useState<Screen>(resumed.screen)
  const [playerCount, setPlayerCount] = useState(boot.count)
  const [names, setNames] = useState<string[]>(boot.names)
  const [game, setGame] = useState<GameState | null>(resumed.game)
  const [selected, setSelected] = useState<Player | null>(null)
  const [dealPad, setDealPad] = useState<RoleSlot[]>([])
  const [votePad, setVotePad] = useState<VoteSlot[]>(resumed.votePad)
  const [voteSlot, setVoteSlot] = useState<number | null>(null)
  const [voteOrder, setVoteOrder] = useState<VoteChoice[]>(['pass', 'fail'])
  const [pendingVote, setPendingVote] = useState<VoteChoice | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const [inqUntil, setInqUntil] = useState(resumed.inqUntil)
  const [clock, setClock] = useState(() => Date.now())
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(() => loadSettings())
  const [timerPlayerId, setTimerPlayerId] = useState<string | null>(null)
  const [timerMode, setTimerMode] = useState<TimerMode>('talk')
  const [timerLeft, setTimerLeft] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const lastBeepSec = useRef<number | null>(null)

  useEffect(() => {
    if (inqUntil <= Date.now()) return
    const id = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [inqUntil])

  useEffect(() => {
    if (!timerRunning) return
    const id = window.setInterval(() => {
      setTimerLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [timerRunning])

  useEffect(() => {
    if (!timerRunning) {
      lastBeepSec.current = null
      return
    }
    if (timerLeft <= 0) {
      setTimerRunning(false)
      lastBeepSec.current = null
      return
    }
    if (timerLeft <= 5 && lastBeepSec.current !== timerLeft) {
      lastBeepSec.current = timerLeft
      playAlarmBeep()
    }
  }, [timerLeft, timerRunning])

  // Keep in-progress game across refresh.
  useEffect(() => {
    if (!game) {
      clearActiveSession()
      return
    }
    saveActiveSession({ game, screen, inqUntil })
  }, [game, screen, inqUntil])

  // Browser / Android back: stay in the active game until it ends.
  useEffect(() => {
    if (!game || game.phase === 'ended') return

    const trap = () => {
      window.history.pushState({ avalonGame: true }, '')
    }
    trap()

    const onPopState = () => {
      trap()
      setSelected(null)
      setVoteSlot(null)
      setPendingVote(null)
      setScreen(game.phase === 'deal' ? 'deal' : 'lobby')
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [game?.phase, Boolean(game)])

  const inqLeftSec = Math.max(0, Math.ceil((inqUntil - clock) / 1000))
  const preview = useMemo(() => roleNamesList(playerCount), [playerCount])

  function syncPlayer(g: GameState, id: string) {
    return g.players.find((p) => p.id === id) ?? null
  }

  function setCount(n: number) {
    setPlayerCount(n)
    setNames((prev) => Array.from({ length: n }, (_, i) => prev[i] ?? ''))
  }

  function startGame() {
    const cleaned = names.map((n) => n.trim())
    if (cleaned.some((n) => !n)) {
      alert('لطفاً نام همهٔ بازیکن‌ها را وارد کنید.')
      return
    }
    if (new Set(cleaned).size !== cleaned.length) {
      alert('نام‌ها نباید تکراری باشند.')
      return
    }
    savePlayers(cleaned.length, cleaned)
    const next = createGame(cleaned)
    setGame(next)
    setSelected(null)
    setVoteSlot(null)
    setPendingVote(null)
    setInqUntil(0)
    setScreen('deal')
  }

  function resumeActiveGame() {
    const session = loadActiveSession()
    if (!session) return
    const nextScreen = SCREENS.has(session.screen as Screen)
      ? (session.screen as Screen)
      : session.game.phase === 'deal'
        ? 'deal'
        : 'lobby'
    setGame(session.game)
    setInqUntil(session.inqUntil)
    setSelected(null)
    setVoteSlot(null)
    setPendingVote(null)
    setVotePad(
      session.game.vote && (nextScreen === 'vote' || nextScreen === 'vote-result')
        ? shuffle([...session.game.vote.slots])
        : [],
    )
    setScreen(nextScreen)
  }

  const hasSavedSession = useMemo(
    () => (screen === 'home' ? Boolean(loadActiveSession()) : false),
    [screen, game],
  )

  function abandonAndSetup() {
    if (loadActiveSession()) {
      const ok = window.confirm(
        'یک بازی ناتمام ذخیره شده. با شروع بازی جدید آن پاک می‌شود. ادامه می‌دهید؟',
      )
      if (!ok) return
      clearActiveSession()
      setGame(null)
    }
    setScreen('setup')
  }

  function goHomeFresh() {
    clearActiveSession()
    setGame(null)
    setSelected(null)
    setVoteSlot(null)
    setPendingVote(null)
    setInqUntil(0)
    setScreen('home')
  }

  function onDealName(p: Player) {
    if (!game || p.revealed) return
    setSelected(p)
    setDealPad(shuffle([...game.slots]))
    setScreen('deal-pick')
  }

  function onDealPick(num: number) {
    if (!selected || !game) return
    const claimed = claimRoleSlot(game, selected.id, num)
    if ('error' in claimed) {
      alert(claimed.error)
      return
    }
    setGame(claimed)
    setSelected(syncPlayer(claimed, selected.id))
    setScreen('deal-role')
  }

  function closeDealRole() {
    setSelected(null)
    setScreen(game?.phase === 'play' ? 'lobby' : 'deal')
  }

  function openAbilities() {
    setSelected(null)
    setScreen('abilities')
  }

  function onAbilityName(p: Player) {
    if (!game || p.abilitySeen) return
    setSelected(p)
    setScreen('ability-confirm')
  }

  function closeAbilityView() {
    if (!selected || !game) {
      setScreen('abilities')
      return
    }
    const next = markAbilitySeen(game, selected.id)
    setGame(next)
    setSelected(null)
    setScreen('abilities')
  }

  function beginInquiry() {
    if (inqLeftSec > 0) return
    setSelected(null)
    setScreen('inq-pick')
  }

  function closeInquiry() {
    setInqUntil(Date.now() + 120 * 1000)
    setClock(Date.now())
    setSelected(null)
    setScreen('lobby')
  }

  function beginVote() {
    if (!game) return
    if (game.vote && !game.vote.revealed) {
      setVotePad(shuffle([...game.vote.slots]))
      setScreen('vote')
      return
    }
    setScreen('vote-setup')
  }

  function confirmVoteSize(size: number) {
    if (!game) return
    const result = startVote(game, size)
    if ('error' in result) {
      alert(result.error)
      return
    }
    setGame(result)
    setVoteSlot(null)
    setVotePad(shuffle([...(result.vote?.slots ?? [])]))
    setScreen('vote')
  }

  function onVoteNumber(num: number) {
    if (!game?.vote) return
    const slot = game.vote.slots.find((s) => s.number === num)
    if (!slot || slot.vote) return
    setVoteSlot(num)
    setPendingVote(null)
    setVoteOrder(Math.random() < 0.5 ? ['pass', 'fail'] : ['fail', 'pass'])
    setScreen('vote-cast')
  }

  function pickVoteChoice(choice: VoteChoice) {
    setPendingVote(choice)
    setScreen('vote-confirm')
  }

  function submitVote() {
    if (!game || voteSlot == null || !pendingVote) return
    const result = castVote(game, voteSlot, pendingVote)
    if ('error' in result) {
      alert(result.error)
      return
    }
    setGame(result)
    setVoteSlot(null)
    setPendingVote(null)
    setVotePad(shuffle([...(result.vote?.slots ?? [])]))
    setScreen('vote')
  }

  function showVoteResult() {
    if (!game) return
    const result = revealVote(game)
    if ('error' in result) {
      alert(result.error)
      return
    }
    setGame(result)
    setScreen('vote-result')
  }

  function continueAfterVote() {
    if (!game) return
    const result = finishVoteAndAdvance(game)
    if ('error' in result) {
      alert(result.error)
      return
    }
    setGame(result)
    setScreen('lobby')
  }

  function confirmEndGame() {
    if (!game) return
    setGame(endGameReveal(game))
    setScreen('reveal')
  }

  function openSettings() {
    const current = loadSettings()
    setSettings(current)
    setSettingsDraft(current)
    setScreen('settings')
  }

  function saveSettingsAndBack() {
    const saved = saveSettings(settingsDraft)
    setSettings(saved)
    setSettingsDraft(saved)
    setScreen(game && game.phase !== 'ended' ? 'lobby' : 'home')
  }

  function openTimer() {
    if (!game) return
    const first = game.players[0]?.id ?? null
    setTimerPlayerId(first)
    setTimerMode('talk')
    setTimerLeft(settings.talkSec)
    setTimerRunning(false)
    lastBeepSec.current = null
    setScreen('timer')
  }

  function startTimerFor(mode: TimerMode, playerId?: string | null) {
    const id = playerId ?? timerPlayerId
    if (!id) return
    const secs = mode === 'talk' ? settings.talkSec : settings.challengeSec
    setTimerPlayerId(id)
    setTimerMode(mode)
    setTimerLeft(secs)
    setTimerRunning(true)
    lastBeepSec.current = null
  }

  function selectTimerPlayer(id: string) {
    setTimerPlayerId(id)
    setTimerRunning(false)
    setTimerMode('talk')
    setTimerLeft(settings.talkSec)
    lastBeepSec.current = null
  }

  function nextTimerPlayer() {
    if (!game || !timerPlayerId) return
    const idx = game.players.findIndex((p) => p.id === timerPlayerId)
    const next = game.players[(idx + 1) % game.players.length]
    if (!next) return
    selectTimerPlayer(next.id)
  }

  const viewed = selected
  const vision = viewed && game ? privateView(viewed, game.players) : null
  const voteTally = game ? tallyVote(game) : null
  const summary = game ? missionSummary(game) : null
  const inquirySide =
    selected?.roleId != null ? ROLES[selected.roleId].allegiance : null
  const sizesForBoard =
    game?.missionSizes ??
    (game ? TEAM_SIZES[game.playerCount] : undefined) ??
    []
  const suggested =
    game && sizesForBoard.length
      ? sizesForBoard[game.currentMission]
      : 3
  const timerPlayer =
    game && timerPlayerId
      ? game.players.find((p) => p.id === timerPlayerId) ?? null
      : null
  const timerMm = Math.floor(timerLeft / 60)
  const timerSs = timerLeft % 60

  return (
    <div className="app">
      <div className="bg-glow" aria-hidden />
      <div className="bg-grain" aria-hidden />

      {screen === 'home' && (
        <section className="screen home fade-in">
          <figure className="home-hero" aria-hidden>
            <img src="/hero.jpg" alt="" draggable={false} />
          </figure>
          <div className="home-veil" aria-hidden />
          <header className="brand">
            <p className="brand__mark">بدون میزبان</p>
            <h1 className="brand__title">آوالون</h1>
            <p className="brand__tagline">
              نقش بگیر، توانایی ببین، رأی مخفی بده — گوشی دست‌به‌دست.
            </p>
          </header>
          <div className="home-dock">
            <div className="home-actions">
              {hasSavedSession && (
                <button className="btn btn--primary" onClick={resumeActiveGame}>
                  ادامه بازی
                </button>
              )}
              <button
                className={`btn ${hasSavedSession ? 'btn--ghost' : 'btn--primary'}`}
                onClick={abandonAndSetup}
              >
                شروع بازی جدید
              </button>
              <button className="btn btn--ghost" onClick={() => setShowGuide(true)}>
                راهنمای نقش‌ها
              </button>
              <button className="btn btn--ghost" onClick={openSettings}>
                تنظیمات
              </button>
            </div>
            <p className="home-foot">۵ تا ۱۰ بازیکن · فارسی · موبایل‌فرست</p>
          </div>
        </section>
      )}

      {screen === 'setup' && (
        <section className="screen setup fade-in">
          <header className="topbar">
            <button className="link" onClick={() => setScreen('home')}>بازگشت</button>
            <h2>چیدمان میز</h2>
            <span />
          </header>

          <div className="count-picker">
            <p className="label">تعداد بازیکن</p>
            <div className="count-row">
              <button
                className="btn btn--icon"
                disabled={playerCount <= MIN}
                onClick={() => setCount(playerCount - 1)}
                aria-label="کم کردن"
              >
                −
              </button>
              <span className="count-num">{toFa(playerCount)}</span>
              <button
                className="btn btn--icon"
                disabled={playerCount >= MAX}
                onClick={() => setCount(playerCount + 1)}
                aria-label="زیاد کردن"
              >
                +
              </button>
            </div>
            <p className="hint">
              شهر {toFa(preview.good.length)} · مافیا {toFa(preview.evil.length)}
            </p>
            <p className="hint muted">
              پیشنهاد اندازه تیم:{' '}
              {(TEAM_SIZES[playerCount] ?? []).map(toFa).join(' · ')}
              {needsTwoFails(playerCount, 3) ? ' · مأموریت ۴: دو شکست' : ''}
            </p>
          </div>

          <div className="role-preview">
            <div className="role-preview__col">
              <h3>شهر</h3>
              <ul>
                {preview.good.map((name, i) => (
                  <li key={`g-${i}`}>{name}</li>
                ))}
              </ul>
            </div>
            <div className="role-preview__col is-evil">
              <h3>مافیا</h3>
              <ul>
                {preview.evil.map((name, i) => (
                  <li key={`e-${i}`}>{name}</li>
                ))}
              </ul>
            </div>
          </div>

          <form
            className="name-list"
            onSubmit={(e) => {
              e.preventDefault()
              startGame()
            }}
          >
            {names.map((name, i) => {
              const isLast = i === names.length - 1
              return (
                <label key={i} className="field">
                  <span>بازیکن {toFa(i + 1)}</span>
                  <input
                    value={name}
                    onChange={(e) => {
                      const next = [...names]
                      next[i] = e.target.value
                      setNames(next)
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      if (isLast) {
                        startGame()
                        return
                      }
                      const next = e.currentTarget
                        .closest('.name-list')
                        ?.querySelector<HTMLInputElement>(
                          `input[data-name-idx="${i + 1}"]`,
                        )
                      next?.focus()
                    }}
                    data-name-idx={i}
                    placeholder="نام را بنویس"
                    autoComplete="off"
                    autoCapitalize="words"
                    enterKeyHint={isLast ? 'done' : 'next'}
                    inputMode="text"
                  />
                </label>
              )
            })}
            <button className="btn btn--primary sticky-cta" type="submit">
              برو به پخش نقش
            </button>
          </form>

          {boot.names.some(Boolean) && (
            <p className="hint muted">نام‌های ذخیره‌شده از دفعهٔ قبل آمده‌اند.</p>
          )}
        </section>
      )}

      {screen === 'deal' && game && (
        <section className="screen deal fade-in">
          <header className="topbar">
            <span />
            <h2>پخش نقش‌ها</h2>
            <span />
          </header>
          <p className="lead">
            اسمت را بزن، یک عدد بردار، نقش را ببین. بعد از دیدن، اسمت خاموش می‌شود.
          </p>
          <p className="progress-line">
            {toFa(game.players.filter((p) => p.revealed).length)} از{' '}
            {toFa(game.players.length)} نقش دیده‌اند
          </p>
          <ul className="player-grid">
            {game.players.map((p) => (
              <li key={p.id}>
                <button
                  className={`player-chip ${p.revealed ? 'is-disabled' : ''}`}
                  disabled={p.revealed}
                  onClick={() => onDealName(p)}
                >
                  <span className="player-chip__name">{p.name}</span>
                  <span className="player-chip__meta">
                    {p.revealed ? 'تمام' : 'گرفتن نقش'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {screen === 'deal-pick' && selected && (
        <section className="screen pick fade-in">
          <header className="topbar">
            <button className="link" onClick={() => setScreen('deal')}>بازگشت</button>
            <h2>{selected.name}</h2>
            <span />
          </header>
          <p className="lead">یک عدد آزاد انتخاب کن. ترتیب عددها هر بار درهم است.</p>
          <div className="keypad">
            {dealPad.map((slot) => {
              const taken = Boolean(slot.takenBy)
              return (
                <button
                  key={slot.number}
                  className={`keypad__key ${taken ? 'is-taken' : ''}`}
                  disabled={taken}
                  onClick={() => onDealPick(slot.number)}
                >
                  <span className="keypad__num">{toFa(slot.number)}</span>
                  <span className="keypad__hint">{taken ? 'گرفته' : 'آزاد'}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {screen === 'deal-role' && selected?.roleId && (
        <section className="screen role fade-in">
          <RoleCard roleId={selected.roleId} playerName={selected.name} />
          <div className="role-dock">
            <p className="role-dock__hint">نقش را حفظ کن، ببند، گوشی را بده.</p>
            <button className="btn btn--primary" onClick={closeDealRole}>
              بستن نقش
            </button>
          </div>
        </section>
      )}

      {screen === 'lobby' && game && (
        <section className="screen lobby fade-in">
          <header className="topbar">
            <button className="link" onClick={openSettings}>تنظیمات</button>
            <h2>میز بازی</h2>
            <button className="link" onClick={() => setShowGuide(true)}>راهنما</button>
          </header>

          <MissionBoard game={game} />

          {summary && (summary.success >= 3 || summary.fail >= 3) && (
            <p className="hint">
              {summary.success >= 3
                ? '۳ مأموریت موفق — وقت حدس مرلین یا پایان بازی است.'
                : '۳ مأموریت شکست — مافیا جلوست. پایان بازی را بزنید.'}
            </p>
          )}

          <p className="lead">عملیات مورد نظر را انتخاب کنید.</p>

          <div className="dash-grid">
            <button className="dash-card" onClick={openAbilities}>
              <span className="dash-card__icon" aria-hidden>◈</span>
              <span className="dash-card__label">نقش‌ها و توانایی‌ها</span>
              <span className="dash-card__desc">نقش و یارهایت را دوباره ببین</span>
            </button>
            <button
              className="dash-card"
              onClick={beginInquiry}
              disabled={inqLeftSec > 0}
            >
              <span className="dash-card__icon" aria-hidden>◎</span>
              <span className="dash-card__label">
                {inqLeftSec > 0 ? `استعلام (${toFa(inqLeftSec)}ث)` : 'استعلام'}
              </span>
              <span className="dash-card__desc">فقط شهر یا مافیا بودن یک نفر</span>
            </button>
            <button className="dash-card" onClick={beginVote}>
              <span className="dash-card__icon" aria-hidden>✦</span>
              <span className="dash-card__label">
                {game.vote && !game.vote.revealed ? 'ادامه رأی‌گیری' : 'رأی‌گیری'}
              </span>
              <span className="dash-card__desc">رأی مخفی خورشید / جمجمه</span>
            </button>
            <button className="dash-card" onClick={openTimer}>
              <span className="dash-card__icon" aria-hidden>◷</span>
              <span className="dash-card__label">تایمر صحبت</span>
              <span className="dash-card__desc">
                صحبت {toFa(settings.talkSec)}ث · چالش {toFa(settings.challengeSec)}ث
              </span>
            </button>
          </div>

          <button className="btn btn--ghost" onClick={() => setScreen('end-confirm')}>
            پایان بازی و افشای نقش‌ها
          </button>
        </section>
      )}

      {screen === 'abilities' && game && (
        <section className="screen fade-in">
          <header className="topbar">
            <button className="link" onClick={() => setScreen('lobby')}>لابی</button>
            <h2>نقش و توانایی</h2>
            <span />
          </header>
          <p className="lead">
            روی اسم خودت بزن. بعد از دیدن، دکمه‌ات خاموش می‌شود تا دیگران تقلب نکنند.
          </p>
          <ul className="player-grid">
            {game.players.map((p) => (
              <li key={p.id}>
                <button
                  className={`player-chip ${p.abilitySeen ? 'is-disabled' : ''}`}
                  disabled={p.abilitySeen}
                  onClick={() => onAbilityName(p)}
                >
                  <span className="player-chip__name">{p.name}</span>
                  <span className="player-chip__meta">
                    {p.abilitySeen ? 'دیده شده' : 'مشاهده'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {screen === 'ability-confirm' && selected && (
        <ConfirmScreen
          title="تأیید هویت"
          body={`فقط ${selected.name} باید ببیند. بقیه نگاه نکنند.`}
          confirmLabel={`من ${selected.name} هستم`}
          onBack={() => setScreen('abilities')}
          onConfirm={() => setScreen('ability-view')}
        />
      )}

      {screen === 'ability-view' && viewed?.roleId && vision && (
        <section className="screen ability-sheet fade-in">
          <div className="ability-sheet__card">
            <div className="ability-sheet__top">
              <img
                className="ability-sheet__thumb"
                src={ROLE_PORTRAITS[viewed.roleId]}
                alt=""
              />
              <div>
                <p className={`ability-sheet__side ${ROLES[viewed.roleId].allegiance === 'good' ? 'is-good' : 'is-evil'}`}>
                  {ROLES[viewed.roleId].allegiance === 'good' ? 'شهر' : 'مافیا'} ·{' '}
                  {ROLES[viewed.roleId].nickname}
                </p>
                <h2>{ROLES[viewed.roleId].name}</h2>
                <p className="ability-sheet__player">{viewed.name}</p>
              </div>
            </div>
            <p className="ability-sheet__ability">{ROLES[viewed.roleId].ability}</p>
            {vision.vision ? (
              <div className="ability-sheet__allies">
                <p className="ability-sheet__allies-title">{vision.vision.title}</p>
                <p className="ability-sheet__allies-sub">{vision.vision.subtitle}</p>
                {vision.vision.entries.length === 0 ? (
                  <p className="hint muted">{vision.vision.emptyMessage ?? 'چیزی نیست.'}</p>
                ) : (
                  <ul>
                    {vision.vision.entries.map((e) => (
                      <li key={e.name}>
                        <span>{e.name}</span>
                        {e.detail && <small>{e.detail}</small>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="hint muted">یار ویژه‌ای نداری.</p>
            )}
          </div>
          <button className="btn btn--primary sticky-cta" onClick={closeAbilityView}>
            متوجه شدم
          </button>
        </section>
      )}

      {screen === 'inq-pick' && game && (
        <section className="screen fade-in">
          <header className="topbar">
            <button className="link" onClick={() => setScreen('lobby')}>لابی</button>
            <h2>استعلام ساید</h2>
            <span />
          </header>
          <p className="lead">
            نام بازیکن را بزن. فقط شهر/مافیا مشخص می‌شود.
          </p>
          <ul className="player-grid">
            {game.players.map((p) => (
              <li key={p.id}>
                <button
                  className="player-chip"
                  onClick={() => {
                    setSelected(p)
                    setScreen('inq-confirm')
                  }}
                >
                  <span className="player-chip__name">{p.name}</span>
                  <span className="player-chip__meta">استعلام ساید</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {screen === 'inq-confirm' && selected && (
        <ConfirmScreen
          title="تأیید استعلام"
          body={`ساید «${selected.name}» را می‌بینی. مطمئنی؟`}
          confirmLabel="تأیید"
          cancelLabel="انصراف"
          onBack={() => setScreen('inq-pick')}
          onConfirm={() => setScreen('inq-flip')}
        />
      )}

      {screen === 'inq-flip' && selected && (
        <section className="screen inquiry fade-in">
          <header className="topbar">
            <button className="link" onClick={() => setScreen('inq-confirm')}>بازگشت</button>
            <h2>{selected.name}</h2>
            <span />
          </header>
          <button
            className="side-flip-card"
            onClick={() => setScreen('inq-result')}
            type="button"
          >
            <span className="side-flip-card__badge">استعلام ساید</span>
            <strong>برای دیدن ساید ضربه بزن</strong>
            <small>نقش دقیق لو نمی‌رود</small>
          </button>
        </section>
      )}

      {screen === 'inq-result' && selected && inquirySide && (
        <section className="screen inquiry fade-in">
          <header className="topbar">
            <span />
            <h2>نتیجه استعلام</h2>
            <span />
          </header>
          <div className={`side-reveal ${inquirySide === 'good' ? 'is-good' : 'is-evil'}`}>
            <div className="side-reveal__dot" aria-hidden />
            <p className="side-reveal__name">{selected.name}</p>
            <h3 className="side-reveal__side">
              {inquirySide === 'good' ? 'شهر' : 'مافیا'}
            </h3>
            <p className="side-reveal__hint">نقش دقیق نشان داده نمی‌شود.</p>
          </div>
          <button className="btn btn--ghost" onClick={closeInquiry}>
            متوجه شدم
          </button>
        </section>
      )}

      {screen === 'vote-setup' && game && (
        <section className="screen fade-in">
          <header className="topbar">
            <button className="link" onClick={() => setScreen('lobby')}>لابی</button>
            <h2>رأی‌گیری</h2>
            <span />
          </header>
          <p className="lead">
            چند نفر در این رأی‌گیری شرکت می‌کنند؟ (پیشنهاد رول‌بوک برای این دور:{' '}
            {toFa(suggested ?? 3)} نفر)
          </p>
          <div className="count-choice">
            {[2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className={`count-choice__btn ${n === suggested ? 'is-suggested' : ''}`}
                onClick={() => confirmVoteSize(n)}
              >
                {toFa(n)}
              </button>
            ))}
          </div>
        </section>
      )}

      {screen === 'vote' && game?.vote && (
        <section className="screen vote fade-in">
          <header className="topbar">
            <button className="link" onClick={() => setScreen('lobby')}>لابی</button>
            <h2>رأی · {toFa(game.vote.teamSize)} نفر</h2>
            <span />
          </header>
          <p className="lead">
            هر عضو تیم یک عدد آزاد برمی‌دارد و رأی مخفی می‌دهد.
            {needsTwoFails(game.playerCount, game.vote.missionIndex)
              ? ' برای شکست این مأموریت ۲ جمجمه لازم است.'
              : ' با ۱ جمجمه مأموریت می‌سوزد.'}
          </p>
          <p className="progress-line">
            {toFa(game.vote.slots.filter((s) => s.vote).length)} از{' '}
            {toFa(game.vote.teamSize)} رأی
          </p>
          <div className="keypad">
            {votePad.map((slot) => {
              const live = game.vote!.slots.find((s) => s.number === slot.number)
              const taken = Boolean(live?.vote)
              return (
                <button
                  key={slot.number}
                  className={`keypad__key ${taken ? 'is-taken' : ''}`}
                  disabled={taken}
                  onClick={() => onVoteNumber(slot.number)}
                >
                  <span className="keypad__num">{toFa(slot.number)}</span>
                  <span className="keypad__hint">{taken ? 'رأی داد' : 'آزاد'}</span>
                </button>
              )
            })}
          </div>
          {allVotesIn(game) && (
            <button className="btn btn--primary sticky-cta" onClick={showVoteResult}>
              نمایش نتیجه رأی‌گیری
            </button>
          )}
        </section>
      )}

      {screen === 'vote-cast' && voteSlot != null && (
        <section className="screen vote-cast fade-in">
          <header className="topbar">
            <button className="link" onClick={() => setScreen('vote')}>بازگشت</button>
            <h2>عدد {toFa(voteSlot)}</h2>
            <span />
          </header>
          <p className="lead">رأی را انتخاب کن؛ بعد باید تأیید کنی. جای دکمه‌ها هر بار عوض می‌شود.</p>
          <div className="vote-choices">
            {voteOrder.map((choice) =>
              choice === 'pass' ? (
                <button
                  key="pass"
                  className="vote-choice vote-choice--pass"
                  onClick={() => pickVoteChoice('pass')}
                >
                  <SunIcon />
                  <span>خورشید</span>
                  <small>موفقیت</small>
                </button>
              ) : (
                <button
                  key="fail"
                  className="vote-choice vote-choice--fail"
                  onClick={() => pickVoteChoice('fail')}
                >
                  <SkullIcon />
                  <span>جمجمه</span>
                  <small>شکست</small>
                </button>
              ),
            )}
          </div>
        </section>
      )}

      {screen === 'vote-confirm' && voteSlot != null && pendingVote && (
        <section className="screen vote-cast fade-in">
          <header className="topbar">
            <button
              className="link"
              onClick={() => {
                setPendingVote(null)
                setScreen('vote-cast')
              }}
            >
              بازگشت
            </button>
            <h2>تأیید رأی</h2>
            <span />
          </header>
          <div
            className={`vote-pending ${pendingVote === 'pass' ? 'is-pass' : 'is-fail'}`}
          >
            {pendingVote === 'pass' ? <SunIcon /> : <SkullIcon />}
            <strong>{pendingVote === 'pass' ? 'خورشید' : 'جمجمه'}</strong>
            <p>برای عدد {toFa(voteSlot)} — مطمئنی؟</p>
          </div>
          <button className="btn btn--primary" onClick={submitVote}>
            تأیید رأی
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => {
              setPendingVote(null)
              setScreen('vote-cast')
            }}
          >
            انصراف
          </button>
        </section>
      )}

      {screen === 'vote-result' && game && voteTally && (
        <section className="screen vote-result fade-in">
          <header className="topbar">
            <span />
            <h2>نتیجه</h2>
            <span />
          </header>
          <div className={`result-banner ${voteTally.success ? 'is-win' : 'is-lose'}`}>
            <p>{voteTally.success ? 'مأموریت موفق' : 'مأموریت شکست'}</p>
          </div>
          <div className="tally-row">
            <div className="tally-card">
              <SunIcon />
              <strong>{toFa(voteTally.pass)}</strong>
              <span>خورشید</span>
            </div>
            <div className="tally-card">
              <SkullIcon />
              <strong>{toFa(voteTally.fail)}</strong>
              <span>جمجمه</span>
            </div>
          </div>
          <p className="hint muted">
            برای شکست {toFa(voteTally.failsNeeded)} جمجمه لازم بود. کی رأی داد مشخص نیست.
          </p>
          <button className="btn btn--primary" onClick={continueAfterVote}>
            بازگشت به لابی
          </button>
        </section>
      )}

      {screen === 'end-confirm' && (
        <ConfirmScreen
          title="پایان بازی؟"
          body="اگر ادامه دهید، همه نقش‌ها افشا می‌شوند و استعلام و رأی‌گیری تمام می‌شود. مطمئنید؟"
          confirmLabel="بله، نقش‌ها را نشان بده"
          cancelLabel="انصراف"
          onBack={() => setScreen('lobby')}
          onConfirm={confirmEndGame}
        />
      )}

      {screen === 'reveal' && game && (
        <section className="screen fade-in">
          <header className="topbar">
            <span />
            <h2>افشای نقش‌ها</h2>
            <span />
          </header>
          <ul className="reveal-list">
            {game.players.map((p) => {
              const role = p.roleId ? ROLES[p.roleId] : null
              if (!role) return null
              return (
                <li
                  key={p.id}
                  className={`reveal-row ${role.allegiance === 'good' ? 'is-good' : 'is-evil'}`}
                >
                  <span className="reveal-row__name">{p.name}</span>
                  <span className="reveal-row__role">
                    {role.name}
                    <small>{role.nickname}</small>
                  </span>
                </li>
              )
            })}
          </ul>
          <button className="btn btn--primary" onClick={() => setScreen('ended')}>
            ادامه
          </button>
        </section>
      )}

      {screen === 'ended' && game && summary && (
        <section className="screen ended fade-in">
          <header className="brand">
            <p className="brand__mark">بازی تمام شد</p>
            <h1 className="brand__title" style={{ fontSize: '2.4rem' }}>
              {summary.success >= 3
                ? 'شهر جلو بود'
                : summary.fail >= 3
                  ? 'مافیا جلو بود'
                  : 'میز بسته شد'}
            </h1>
            <p className="brand__tagline">
              مأموریت موفق: {toFa(summary.success)} · شکست: {toFa(summary.fail)}
            </p>
          </header>
          <MissionBoard game={game} />
          <button className="btn btn--primary" onClick={goHomeFresh}>
            بازی جدید
          </button>
        </section>
      )}

      {screen === 'timer' && game && (
        <section className="screen timer fade-in">
          <header className="topbar">
            <button
              className="link"
              onClick={() => {
                setTimerRunning(false)
                setScreen('lobby')
              }}
            >
              لابی
            </button>
            <h2>تایمر نوبت</h2>
            <button className="link" onClick={openSettings}>تنظیمات</button>
          </header>

          <p className="lead">
            بدون میزبان: برای هر نفر تایمر صحبت بزن؛ چالش نصف (یا مقدار تنظیمات) است.
            ۵ ثانیهٔ آخر بیپ ثانیه‌ای می‌زند.
          </p>

          <ul className="timer-players">
            {game.players.map((p) => (
              <li key={p.id}>
                <button
                  className={`timer-player ${p.id === timerPlayerId ? 'is-active' : ''}`}
                  onClick={() => selectTimerPlayer(p.id)}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>

          <div
            className={`timer-face ${timerMode === 'challenge' ? 'is-challenge' : ''} ${
              timerLeft > 0 && timerLeft <= 5 ? 'is-urgent' : ''
            } ${timerLeft === 0 ? 'is-done' : ''}`}
          >
            <p className="timer-face__who">{timerPlayer?.name ?? '—'}</p>
            <p className="timer-face__mode">
              {timerMode === 'talk' ? 'صحبت' : 'چالش'}
            </p>
            <p className="timer-face__clock" aria-live="polite">
              {toFa(timerMm)}:{toFa(timerSs).padStart(2, '۰')}
            </p>
            <p className="timer-face__hint muted">
              {timerLeft === 0
                ? 'زمان تمام شد'
                : timerRunning
                  ? 'در حال شمارش'
                  : 'آماده'}
            </p>
          </div>

          <div className="timer-actions">
            <button
              className="btn btn--primary"
              onClick={() => startTimerFor('talk')}
              disabled={!timerPlayerId}
            >
              شروع صحبت ({toFa(settings.talkSec)}ث)
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => startTimerFor('challenge')}
              disabled={!timerPlayerId}
            >
              چالش ({toFa(settings.challengeSec)}ث)
            </button>
            <div className="timer-actions__row">
              <button
                className="btn btn--ghost"
                onClick={() => setTimerRunning((r) => !r)}
                disabled={timerLeft <= 0}
              >
                {timerRunning ? 'توقف' : 'ادامه'}
              </button>
              <button className="btn btn--ghost" onClick={nextTimerPlayer}>
                نفر بعد
              </button>
            </div>
          </div>
        </section>
      )}

      {screen === 'settings' && (
        <section className="screen fade-in">
          <header className="topbar">
            <button
              className="link"
              onClick={() =>
                setScreen(game && game.phase !== 'ended' ? 'lobby' : 'home')
              }
            >
              بازگشت
            </button>
            <h2>تنظیمات</h2>
            <span />
          </header>

          <p className="lead">زمان صحبت و چالش برای تایمر نوبت‌ها.</p>

          <div className="settings-block">
            <p className="label">زمان صحبت (ثانیه)</p>
            <div className="count-row">
              <button
                className="btn btn--icon"
                disabled={settingsDraft.talkSec <= MIN_SEC}
                onClick={() =>
                  setSettingsDraft((s) => ({
                    ...s,
                    talkSec: Math.max(MIN_SEC, s.talkSec - 5),
                  }))
                }
                aria-label="کم کردن صحبت"
              >
                −
              </button>
              <span className="count-num">{toFa(settingsDraft.talkSec)}</span>
              <button
                className="btn btn--icon"
                disabled={settingsDraft.talkSec >= MAX_SEC}
                onClick={() =>
                  setSettingsDraft((s) => ({
                    ...s,
                    talkSec: Math.min(MAX_SEC, s.talkSec + 5),
                  }))
                }
                aria-label="زیاد کردن صحبت"
              >
                +
              </button>
            </div>
            <p className="hint muted">پیشنهاد چالش: نصف صحبت</p>
          </div>

          <div className="settings-block">
            <p className="label">زمان چالش (ثانیه)</p>
            <div className="count-row">
              <button
                className="btn btn--icon"
                disabled={settingsDraft.challengeSec <= MIN_SEC}
                onClick={() =>
                  setSettingsDraft((s) => ({
                    ...s,
                    challengeSec: Math.max(MIN_SEC, s.challengeSec - 5),
                  }))
                }
                aria-label="کم کردن چالش"
              >
                −
              </button>
              <span className="count-num">{toFa(settingsDraft.challengeSec)}</span>
              <button
                className="btn btn--icon"
                disabled={settingsDraft.challengeSec >= MAX_SEC}
                onClick={() =>
                  setSettingsDraft((s) => ({
                    ...s,
                    challengeSec: Math.min(MAX_SEC, s.challengeSec + 5),
                  }))
                }
                aria-label="زیاد کردن چالش"
              >
                +
              </button>
            </div>
            <button
              className="link settings-half"
              type="button"
              onClick={() =>
                setSettingsDraft((s) => ({
                  ...s,
                  challengeSec: Math.max(MIN_SEC, Math.round(s.talkSec / 2)),
                }))
              }
            >
              بگذار نصف صحبت ({toFa(Math.max(MIN_SEC, Math.round(settingsDraft.talkSec / 2)))}ث)
            </button>
          </div>

          <button className="btn btn--primary sticky-cta" onClick={saveSettingsAndBack}>
            ذخیره تنظیمات
          </button>
        </section>
      )}

      {showGuide && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__panel">
            <header className="modal__head">
              <h2>دفتر نقش‌ها</h2>
              <button className="link" onClick={() => setShowGuide(false)}>بستن</button>
            </header>
            <div className="modal__body">
              {(Object.keys(ROLES) as RoleId[]).map((id) => {
                const r = ROLES[id]
                const art = ROLE_PORTRAITS[id]
                return (
                  <article key={id} className="guide-role">
                    <div className="guide-role__head">
                      {art ? (
                        <img className="guide-role__thumb" src={art} alt="" />
                      ) : (
                        <div className="guide-role__thumb guide-role__thumb--empty" />
                      )}
                      <div className="guide-role__titles">
                        <h3>
                          {r.name}
                          <span className={r.allegiance === 'good' ? 'is-good' : 'is-evil'}>
                            {r.nickname}
                          </span>
                        </h3>
                      </div>
                    </div>
                    <p>{r.lore}</p>
                    <p className="guide-role__ability">{r.ability}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ConfirmScreen({
  title,
  body,
  confirmLabel,
  cancelLabel = 'من این شخص نیستم',
  onBack,
  onConfirm,
}: {
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  onBack: () => void
  onConfirm: () => void
}) {
  return (
    <section className="screen confirm fade-in">
      <header className="topbar">
        <button className="link" onClick={onBack}>بازگشت</button>
        <h2>{title}</h2>
        <span />
      </header>
      <div className="confirm-card">
        <p>{body}</p>
      </div>
      <button className="btn btn--primary" onClick={onConfirm}>
        {confirmLabel}
      </button>
      <button className="btn btn--ghost" onClick={onBack}>
        {cancelLabel}
      </button>
    </section>
  )
}

function MissionBoard({ game }: { game: GameState }) {
  const sizes =
    game.missionSizes?.length === 5
      ? game.missionSizes
      : TEAM_SIZES[game.playerCount] ?? []
  return (
    <div className="mission-board" aria-label="وضعیت مأموریت‌ها">
      {game.missions.map((status, i) => (
        <div
          key={i}
          className={`mission-dot ${status} ${i === game.currentMission && game.phase === 'play' ? 'is-current' : ''}`}
        >
          <span className="mission-dot__n">{toFa(i + 1)}</span>
          <span className="mission-dot__size">{toFa(sizes[i] ?? 0)}</span>
        </div>
      ))}
    </div>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden>
      <circle cx="24" cy="24" r="10" fill="currentColor" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <rect
          key={deg}
          x="22"
          y="2"
          width="4"
          height="8"
          rx="2"
          fill="currentColor"
          transform={`rotate(${deg} 24 24)`}
        />
      ))}
    </svg>
  )
}

function SkullIcon() {
  return (
    <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden>
      <path
        d="M24 6c-10 0-18 7-18 16 0 6 3 11 8 14v6h6v-4h8v4h6v-6c5-3 8-8 8-14 0-9-8-16-18-16z"
        fill="currentColor"
      />
      <circle cx="17" cy="22" r="3.5" fill="#0c0a09" />
      <circle cx="31" cy="22" r="3.5" fill="#0c0a09" />
      <path d="M21 30h6v3h-6z" fill="#0c0a09" />
    </svg>
  )
}

function toFa(n: number): string {
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!)
}
