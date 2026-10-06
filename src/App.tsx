import { useEffect, useMemo, useRef, useState } from 'react'
import { LeaderWheel } from './components/LeaderWheel'
import { RoleCard, ROLE_PORTRAITS } from './components/RoleCard'
import { ROLES, type RoleId } from './data/roles'
import { TEAM_SIZES, roleNamesList, needsTwoFails } from './data/setups'
import {
  allVotesIn,
  assignLeader,
  canPerformInquiry,
  castVote,
  claimRoleSlot,
  climaxKind,
  completeInquiry,
  completedMissions,
  createGame,
  declareEvilWin,
  endGameReveal,
  finishVoteAndAdvance,
  inquiryHolder,
  inquiryTargets,
  markAbilitySeen,
  missionSummary,
  pickFirstInquirerId,
  privateView,
  rejectTeamProposal,
  resolveAssassinShot,
  revealVote,
  shuffle,
  startVote,
  tallyVote,
  undoTeamRejection,
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
  MAP_BACKGROUNDS,
  type AppSettings,
  type FirstInquirerMode,
  type MapBgIndex,
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
  | 'leader-spin'
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
  | 'climax-evil'
  | 'assassin-intro'
  | 'assassin-pick'
  | 'assassin-confirm'
  | 'assassin-result'
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
  'leader-spin',
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
  'climax-evil',
  'assassin-intro',
  'assassin-pick',
  'assassin-confirm',
  'assassin-result',
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
  spinLeaderId: string | null
  spinInquirerId: string | null
} {
  const session = loadActiveSession()
  if (!session) {
    return {
      screen: 'home',
      game: null,
      inqUntil: 0,
      votePad: [],
      spinLeaderId: null,
      spinInquirerId: null,
    }
  }
  let screen = SCREENS.has(session.screen as Screen)
    ? (session.screen as Screen)
    : session.game.phase === 'deal'
      ? 'deal'
      : 'lobby'

  // Never reopen a private mid-flow on the spinner itself after refresh.
  if (screen === 'leader-spin') screen = 'lobby'

  const spinLeaderId = session.game.leaderId ?? null
  const spinInquirerId = session.game.firstInquirerId ?? null

  return {
    screen,
    game: session.game,
    inqUntil: session.inqUntil,
    votePad:
      session.game.vote && (screen === 'vote' || screen === 'vote-result')
        ? shuffle([...session.game.vote.slots])
        : [],
    spinLeaderId,
    spinInquirerId,
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
  const [guideTab, setGuideTab] = useState<'rules' | 'roles'>('rules')
  const [inqUntil, setInqUntil] = useState(resumed.inqUntil)
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(() => loadSettings())
  const [timerPlayerId, setTimerPlayerId] = useState<string | null>(null)
  const [timerMode, setTimerMode] = useState<TimerMode>('talk')
  const [timerLeft, setTimerLeft] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [spinLeaderId, setSpinLeaderId] = useState<string | null>(
    resumed.spinLeaderId,
  )
  const [spinInquirerId, setSpinInquirerId] = useState<string | null>(
    resumed.spinInquirerId,
  )
  const lastBeepSec = useRef<number | null>(null)

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

  const preview = useMemo(() => roleNamesList(playerCount), [playerCount])

  function syncPlayer(g: GameState, id: string) {
    return g.players.find((p) => p.id === id) ?? null
  }

  function setCount(n: number) {
    setPlayerCount(n)
    setNames((prev) => Array.from({ length: n }, (_, i) => prev[i] ?? ''))
  }

  function moveName(index: number, dir: -1 | 1) {
    setNames((prev) => {
      const j = index + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[j]] = [next[j]!, next[index]!]
      return next
    })
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
    clearActiveSession()
    savePlayers(cleaned.length, cleaned)
    const next = createGame(cleaned)
    setGame(next)
    setSelected(null)
    setVoteSlot(null)
    setPendingVote(null)
    setInqUntil(0)
    setSpinLeaderId(null)
    setSpinInquirerId(null)
    setScreen('deal')
  }

  function beginLeaderSpin(g: GameState) {
    if (completedMissions(g) >= 1) return
    const leaderId =
      g.players[Math.floor(Math.random() * g.players.length)]!.id
    const inquirerId = settings.inquiryEnabled
      ? pickFirstInquirerId(g.players, leaderId, settings.firstInquirerMode)
      : null
    setSpinLeaderId(leaderId)
    setSpinInquirerId(inquirerId)
    setScreen('leader-spin')
  }

  function finishLeaderSpin() {
    if (game && spinLeaderId) {
      setGame(assignLeader(game, spinLeaderId, spinInquirerId))
    }
    setScreen('lobby')
  }

  function resumeActiveGame() {
    const session = loadActiveSession()
    if (!session) return
    let nextScreen = SCREENS.has(session.screen as Screen)
      ? (session.screen as Screen)
      : session.game.phase === 'deal'
        ? 'deal'
        : 'lobby'
    if (nextScreen === 'leader-spin') nextScreen = 'lobby'
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
    setSpinLeaderId(session.game.leaderId ?? null)
    setSpinInquirerId(session.game.firstInquirerId ?? null)
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
    setSpinLeaderId(null)
    setSpinInquirerId(null)
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
    if (!settings.inquiryEnabled || !game) return
    if (!canPerformInquiry(game)) return
    setSelected(null)
    setScreen('inq-pick')
  }

  function closeInquiry() {
    if (!game || !selected) {
      setSelected(null)
      setScreen('lobby')
      return
    }
    const next = completeInquiry(game, selected.id)
    if ('error' in next) {
      alert(next.error)
      return
    }
    setGame(next)
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

  function confirmStartMission() {
    if (!game) return
    const size =
      (game.missionSizes?.length === 5
        ? game.missionSizes
        : TEAM_SIZES[game.playerCount] ?? [])[game.currentMission] ?? 3
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
    const kind = climaxKind(result)
    if (kind === 'evil') {
      setGame(declareEvilWin(result))
      setScreen('climax-evil')
      return
    }
    if (kind === 'assassin') {
      setSelected(null)
      setScreen('assassin-intro')
      return
    }
    setScreen('lobby')
  }

  function openAssassinShot() {
    if (!game || climaxKind(game) !== 'assassin') return
    if (game.winner) {
      setScreen('reveal')
      return
    }
    setSelected(null)
    setScreen('assassin-intro')
  }

  function confirmAssassinShot() {
    if (!game || !selected) return
    const result = resolveAssassinShot(game, selected.id)
    if ('error' in result) {
      alert(result.error)
      return
    }
    setGame(result)
    setScreen('assassin-result')
  }

  function confirmEndGame() {
    if (!game) return
    const kind = climaxKind(game)
    if (kind === 'evil' && !game.winner) {
      setGame(declareEvilWin(game))
      setScreen('climax-evil')
      return
    }
    if (kind === 'assassin' && !game.winner) {
      openAssassinShot()
      return
    }
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
  const leaderPlayer =
    game?.leaderId != null
      ? game.players.find((p) => p.id === game.leaderId) ?? null
      : null
  const inquiryHolderPlayer = game ? inquiryHolder(game) : null
  const inquiryReady = game ? canPerformInquiry(game) : false
  const missionsDone = game ? completedMissions(game) : 0
  const inquiryTargetList = game ? inquiryTargets(game) : []
  const hasInquiryHolder = Boolean(game && inquiryHolder(game))
  const inquiryBlocked = !game
    ? null
    : !hasInquiryHolder
      ? 'اول انتخاب لیدر را بزنید'
      : inquiryTargetList.length === 0
        ? 'کسی برای استعلام نمانده'
        : !inquiryReady
          ? missionsDone < 2
            ? 'اولین استعلام بعد از مأموریت ۲'
            : `بعد از مأموریت ${toFa(missionsDone + 1)}`
          : null
  const decided = game ? climaxKind(game) : null
  const rejectionCount = game?.teamRejections ?? 0
  const rejectionCap = rejectionCount >= 5
  const missionFailWin = Boolean(summary && summary.fail >= 3)
  const gameLocked = Boolean(
    game?.winner || decided === 'assassin' || missionFailWin || rejectionCap,
  )

  function bumpRejection() {
    if (!game || game.winner || missionFailWin || decided === 'assassin') return
    if ((game.teamRejections ?? 0) >= 5) return
    if (game.vote && !game.vote.revealed) {
      alert('اول مأموریت فعلی را تمام کنید.')
      return
    }
    const next = rejectTeamProposal(game)
    if ('error' in next) {
      alert(next.error)
      return
    }
    setGame(next)
  }

  function undoRejection() {
    if (!game || game.winner || missionFailWin || decided === 'assassin') return
    const next = undoTeamRejection(game)
    if ('error' in next) {
      alert(next.error)
      return
    }
    setGame(next)
  }

  const assassinTarget =
    game?.assassinTargetId != null
      ? game.players.find((p) => p.id === game.assassinTargetId) ?? null
      : null

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
              نقش محرمانه، مأموریت مخفی، استعلام ساید — بدون میزبان.
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
              <button className="btn btn--ghost" onClick={() => {
                setGuideTab('rules')
                setShowGuide(true)
              }}>
                راهنمای بازی
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
              اندازه تیم:{' '}
              {(TEAM_SIZES[playerCount] ?? []).map(toFa).join(' · ')}
              {needsTwoFails(playerCount, 3) ? ' · مأموریت ۴: ۲ جمجمه' : ''}
            </p>
            {needsTwoFails(playerCount, 3) && (
              <p className="hint muted">
                از ۷ نفر به بالا، مأموریت چهارم فقط با دو کارت جمجمه می‌سوزد.
              </p>
            )}
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
            <div className="seat-note">
              <p className="seat-note__title">ترتیب نشستن دور میز</p>
              <p>
                اسم‌ها را به همان ترتیبی بنویسید که دور میز نشسته‌اید؛ از یک نفر شروع
                کنید و در جهت عقربه‌های ساعت جلو بروید. «سمت راست لیدر» روی همین
                ترتیب حساب می‌شود. اگر جابه‌جا نوشتید، با دکمه‌های بالا/پایین جایشان را
                عوض کنید.
              </p>
            </div>

            {names.map((name, i) => {
              const isLast = i === names.length - 1
              return (
                <div key={i} className="field field--seat">
                  <div className="field__head">
                    <span>صندلی {toFa(i + 1)}</span>
                    <div className="seat-move">
                      <button
                        type="button"
                        className="seat-move__btn"
                        disabled={i === 0}
                        onClick={() => moveName(i, -1)}
                        aria-label="جابه‌جایی به بالا"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="seat-move__btn"
                        disabled={isLast}
                        onClick={() => moveName(i, 1)}
                        aria-label="جابه‌جایی به پایین"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
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
                    placeholder="نام بازیکن"
                    autoComplete="off"
                    autoCapitalize="words"
                    enterKeyHint={isLast ? 'done' : 'next'}
                    inputMode="text"
                  />
                </div>
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

      {screen === 'leader-spin' && game && spinLeaderId && (
        <LeaderWheel
          key={spinLeaderId}
          players={game.players}
          inquiryEnabled={settings.inquiryEnabled}
          leaderId={spinLeaderId}
          firstInquirerId={spinInquirerId}
          onCancel={() => setScreen('lobby')}
          onFinished={finishLeaderSpin}
        />
      )}

      {screen === 'lobby' && game && (
        <MapStage
          mode="lobby"
          game={game}
          mapBg={settings.mapBg}
          inquiryEnabled={settings.inquiryEnabled}
          inquiryReady={inquiryReady}
          inquiryHint={
            inquiryReady
              ? inquiryHolderPlayer
                ? `نوبت ${inquiryHolderPlayer.name}`
                : 'ساید یک نفر'
              : inquiryBlocked ?? ''
          }
          missionLabel={
            game.vote && !game.vote.revealed ? 'ادامه مأموریت' : 'مأموریت'
          }
          missionDisabled={gameLocked && !(game.vote && !game.vote.revealed)}
          inquiryDisabled={!inquiryReady || gameLocked}
          leaderName={leaderPlayer?.name ?? null}
          inquiryName={
            settings.inquiryEnabled ? inquiryHolderPlayer?.name ?? null : null
          }
          leaderLabel={
            missionsDone >= 1
              ? 'لیدر ثابت شد'
              : game.leaderChosen
                ? 'چرخش دوبارهٔ لیدر'
                : 'انتخاب لیدر'
          }
          leaderDisabled={gameLocked || missionsDone >= 1}
          leaderHint={
            missionsDone >= 1
              ? 'بعد از مأموریت ۱ دیگر عوض نمی‌شود'
              : 'چرخش میز'
          }
          timerHint={`${toFa(settings.talkSec)}ث · چالش ${toFa(settings.challengeSec)}ث`}
          rejectionCount={rejectionCount}
          rejectionBumpDisabled={
            Boolean(game.winner) ||
            missionFailWin ||
            decided === 'assassin' ||
            rejectionCap ||
            Boolean(game.vote && !game.vote.revealed)
          }
          rejectionUndoDisabled={
            rejectionCount <= 0 ||
            Boolean(game.winner) ||
            missionFailWin ||
            decided === 'assassin'
          }
          climax={
            decided === 'assassin' && !game.winner
              ? 'assassin'
              : decided === 'evil' && !game.winner
                ? rejectionCap
                  ? 'reject'
                  : 'evil'
                : null
          }
          onSettings={openSettings}
          onGuide={() => {
            setGuideTab('rules')
            setShowGuide(true)
          }}
          onCycleMap={() => {
            const next = ((settings.mapBg + 1) % MAP_BACKGROUNDS.length) as MapBgIndex
            const saved = saveSettings({ ...settings, mapBg: next })
            setSettings(saved)
            setSettingsDraft(saved)
          }}
          onMission={beginVote}
          onInquiry={beginInquiry}
          onLeader={() => beginLeaderSpin(game)}
          onAbilities={openAbilities}
          onTimer={openTimer}
          onEnd={() => setScreen('end-confirm')}
          onBumpRejection={bumpRejection}
          onUndoRejection={undoRejection}
          onAssassin={openAssassinShot}
          onDeclareEvil={() => {
            setGame(declareEvilWin(game))
            setScreen('climax-evil')
          }}
        />
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
            {inquiryHolderPlayer
              ? `${inquiryHolderPlayer.name} یک نفر را انتخاب می‌کند. فقط شهر/مافیا مشخص می‌شود؛ بعد استعلام به همان نفر می‌رسد.`
              : 'یک نفر را انتخاب کن. فقط شهر/مافیا مشخص می‌شود.'}
          </p>
          {inquiryTargetList.length === 0 ? (
            <p className="hint">
              {!hasInquiryHolder
                ? 'دارندهٔ استعلام مشخص نیست. از لابی «انتخاب لیدر» را بزنید تا اولین استعلام‌کننده معلوم شود.'
                : 'کسی برای استعلام باقی نمانده — همهٔ واجدین قبلاً استعلام گرفته‌اند.'}
            </p>
          ) : (
            <ul className="player-grid">
              {inquiryTargetList.map((p) => (
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
          )}
          {(game.inquiryHistoryIds?.length ?? 0) > 0 && (
            <p className="hint muted">
              کسانی که قبلاً استعلام گرفته‌اند دیگر قابل استعلام نیستند.
            </p>
          )}
        </section>
      )}

      {screen === 'inq-confirm' && selected && (
        <ConfirmScreen
          title="تأیید استعلام"
          body={`ساید «${selected.name}» را می‌بینی؛ بعد استعلام به ${selected.name} می‌رسد. مطمئنی؟`}
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
          <p className="hint">
            استعلام بعدی دست <strong>{selected.name}</strong> است.
          </p>
          <button className="btn btn--ghost" onClick={closeInquiry}>
            متوجه شدم
          </button>
        </section>
      )}

      {screen === 'vote-setup' && game && (
        <ConfirmScreen
          title={`مأموریت ${toFa((game.currentMission ?? 0) + 1)}`}
          body={
            needsTwoFails(game.playerCount, game.currentMission)
              ? `طبق رول‌بوک ${toFa(suggested ?? 3)} نفر به مأموریت می‌روند. برای سوختن این مأموریت ۲ جمجمه لازم است. آماده‌اید؟`
              : `طبق رول‌بوک ${toFa(suggested ?? 3)} نفر به مأموریت می‌روند. با ۱ جمجمه مأموریت می‌سوزد. آماده‌اید؟`
          }
          confirmLabel="شروع مأموریت"
          cancelLabel="بازگشت به لابی"
          onBack={() => setScreen('lobby')}
          onConfirm={confirmStartMission}
        />
      )}

      {screen === 'vote' && game?.vote && (
        <section className="screen vote fade-in">
          <header className="topbar">
            <button className="link" onClick={() => setScreen('lobby')}>لابی</button>
            <h2>
              مأموریت {toFa(game.vote.missionIndex + 1)} · {toFa(game.vote.teamSize)} نفر
            </h2>
            <span />
          </header>
          <p className="lead">
            هر عضو تیم یک عدد آزاد برمی‌دارد و کارت مخفی می‌دهد.
            {needsTwoFails(game.playerCount, game.vote.missionIndex)
              ? ' برای شکست این مأموریت ۲ جمجمه لازم است.'
              : ' با ۱ جمجمه مأموریت می‌سوزد.'}
          </p>
          <p className="progress-line">
            {toFa(game.vote.slots.filter((s) => s.vote).length)} از{' '}
            {toFa(game.vote.teamSize)} کارت
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
                  <span className="keypad__hint">{taken ? 'داد' : 'آزاد'}</span>
                </button>
              )
            })}
          </div>
          {allVotesIn(game) && (
            <button className="btn btn--primary sticky-cta" onClick={showVoteResult}>
              نمایش نتیجه مأموریت
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
          <p className="lead">کارت را انتخاب کن؛ بعد باید تأیید کنی. جای دکمه‌ها هر بار عوض می‌شود.</p>
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
            <h2>تأیید کارت</h2>
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
            تأیید کارت
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
            برای شکست {toFa(voteTally.failsNeeded)} جمجمه لازم بود. کسی که چه کارتی داد مشخص نیست.
          </p>
          <button className="btn btn--primary" onClick={continueAfterVote}>
            بازگشت به لابی
          </button>
        </section>
      )}

      {screen === 'climax-evil' && game && (
        <section className="screen climax climax--evil fade-in">
          <p className="climax__kicker">
            {(game.teamRejections ?? 0) >= 5
              ? 'پنج تیم بی‌رأی'
              : 'سه جمجمه روی میز'}
          </p>
          <h1 className="climax__title">مافیا پیروز شد</h1>
          <p className="climax__body">
            {(game.teamRejections ?? 0) >= 5
              ? 'پنج بار پیشنهاد تیم رأی نیاورد. شهر فرصت مأموریت را از دست داد.'
              : 'سه مأموریت شکست خورد. شهر دیگر فرصتی ندارد — تاریکی بر میز حکم می‌راند.'}
          </p>
          <MissionBoard game={game} />
          <button
            className="btn btn--primary"
            onClick={() => setScreen('reveal')}
          >
            افشای نقش‌ها
          </button>
        </section>
      )}

      {screen === 'assassin-intro' && game && (
        <section className="screen climax climax--shot fade-in">
          <p className="climax__kicker">سه خورشید روشن شد</p>
          <h1 className="climax__title">شلیک اساسین</h1>
          <p className="climax__body">
            شهر مأموریت‌ها را برد؛ ولی هنوز تمام نشده. اساسین یک تیر دارد — اگر
            مرلین را بزند، پیروزی از آنِ مافیاست. اگر خطا کند، شهر قهرمان می‌ماند.
          </p>
          <p className="hint muted">میز با هم حرف بزنید؛ بعد اسم هدف را انتخاب کنید.</p>
          <button
            className="btn btn--primary"
            onClick={() => {
              setSelected(null)
              setScreen('assassin-pick')
            }}
          >
            انتخاب هدف
          </button>
          <button className="btn btn--ghost" onClick={() => setScreen('lobby')}>
            بعداً
          </button>
        </section>
      )}

      {screen === 'assassin-pick' && game && (
        <section className="screen fade-in">
          <header className="topbar">
            <button className="link" onClick={() => setScreen('assassin-intro')}>
              بازگشت
            </button>
            <h2>هدف شلیک</h2>
            <span />
          </header>
          <p className="lead">چه کسی مرلین است؟ یک نفر را نشانه بگیرید.</p>
          <ul className="player-grid">
            {game.players.map((p) => (
              <li key={p.id}>
                <button
                  className="player-chip"
                  onClick={() => {
                    setSelected(p)
                    setScreen('assassin-confirm')
                  }}
                >
                  <span className="player-chip__name">{p.name}</span>
                  <span className="player-chip__meta">شلیک</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {screen === 'assassin-confirm' && selected && (
        <ConfirmScreen
          title="تأیید شلیک"
          body={`اساسین به «${selected.name}» شلیک می‌کند. این تیر برنمی‌گردد. مطمئنید؟`}
          confirmLabel="شلیک کن"
          cancelLabel="انصراف"
          onBack={() => setScreen('assassin-pick')}
          onConfirm={confirmAssassinShot}
        />
      )}

      {screen === 'assassin-result' && game && (
        <section
          className={`screen climax ${game.assassinHit ? 'climax--evil' : 'climax--good'} fade-in`}
        >
          <p className="climax__kicker">
            {game.assassinHit ? 'تیر به هدف خورد' : 'تیر خطا رفت'}
          </p>
          <h1 className="climax__title">
            {game.assassinHit ? 'مافیا دزدیدش' : 'شهر ایستاد'}
          </h1>
          <p className="climax__body">
            {assassinTarget ? (
              game.assassinHit ? (
                <>
                  <strong>{assassinTarget.name}</strong> مرلین بود. اساسین درست زد —
                  پیروزی از آنِ مافیاست.
                </>
              ) : (
                <>
                  <strong>{assassinTarget.name}</strong> مرلین نبود. شهر سه مأموریت
                  را حفظ کرد و برنده ماند.
                </>
              )
            ) : game.assassinHit ? (
              'اساسین مرلین را زد. مافیا برنده است.'
            ) : (
              'اساسین خطا کرد. شهر برنده است.'
            )}
          </p>
          <button className="btn btn--primary" onClick={() => setScreen('reveal')}>
            افشای نقش‌ها
          </button>
        </section>
      )}

      {screen === 'end-confirm' && (
        <ConfirmScreen
          title="پایان بازی؟"
          body={
            decided === 'assassin'
              ? 'هنوز شلیک اساسین مانده. اگر ادامه دهید بدون شلیک، نقش‌ها افشا می‌شوند. مطمئنید؟'
              : decided === 'evil'
                ? 'سه مأموریت شکست خورده — مافیا برنده است. نقش‌ها را نشان می‌دهید؟'
                : 'اگر ادامه دهید، همه نقش‌ها افشا می‌شوند. مطمئنید؟'
          }
          confirmLabel={
            decided === 'assassin' && !game?.winner
              ? 'برو به شلیک اساسین'
              : decided === 'evil' && !game?.winner
                ? 'اعلام پیروزی مافیا'
                : 'بله، نقش‌ها را نشان بده'
          }
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
              {game.winner === 'good'
                ? 'پیروزی شهر'
                : game.winner === 'evil'
                  ? 'پیروزی مافیا'
                  : summary.success >= 3
                    ? 'شهر جلو بود'
                    : summary.fail >= 3
                      ? 'مافیا جلو بود'
                      : 'میز بسته شد'}
            </h1>
            <p className="brand__tagline">
              {game.assassinHit === true
                ? 'اساسین مرلین را زد'
                : game.assassinHit === false
                  ? 'شلیک اساسین خطا رفت'
                  : `مأموریت موفق: ${toFa(summary.success)} · شکست: ${toFa(summary.fail)}`}
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
        <section className="screen settings fade-in">
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

          <div className="settings-section">
            <div className="settings-section__head">
              <h3>استعلام ساید</h3>
              <p>
                اولین استعلام بعد از مأموریت ۲؛ بعد به نفری که استعلام شده می‌رسد.
                کسانی که قبلاً استعلام گرفته‌اند دیگر هدف نمی‌شوند.
              </p>
            </div>

            <label className="settings-toggle">
              <div className="settings-toggle__text">
                <strong>فعال بودن استعلام</strong>
                <span>پیش‌فرض: روشن</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settingsDraft.inquiryEnabled}
                className={`switch ${settingsDraft.inquiryEnabled ? 'is-on' : ''}`}
                onClick={() =>
                  setSettingsDraft((s) => ({
                    ...s,
                    inquiryEnabled: !s.inquiryEnabled,
                  }))
                }
              >
                <span className="switch__knob" />
              </button>
            </label>

            <div
              className={`settings-options ${
                settingsDraft.inquiryEnabled ? '' : 'is-disabled'
              }`}
            >
              <p className="label">اولین استعلام‌کننده</p>
              <div className="option-cards">
                {(
                  [
                    {
                      id: 'rightOfLeader' as FirstInquirerMode,
                      title: 'سمت راست لیدر',
                      desc: 'نفر سمت راست لیدر اول، استعلام را شروع می‌کند.',
                    },
                    {
                      id: 'random' as FirstInquirerMode,
                      title: 'تصادفی',
                      desc: 'یکی از بازیکن‌ها به‌صورت رندوم انتخاب می‌شود.',
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`option-card ${
                      settingsDraft.firstInquirerMode === opt.id ? 'is-active' : ''
                    }`}
                    disabled={!settingsDraft.inquiryEnabled}
                    onClick={() =>
                      setSettingsDraft((s) => ({
                        ...s,
                        firstInquirerMode: opt.id,
                      }))
                    }
                  >
                    <span className="option-card__radio" aria-hidden />
                    <span className="option-card__body">
                      <strong>{opt.title}</strong>
                      <small>{opt.desc}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section__head">
              <h3>تایمر نوبت</h3>
              <p>زمان صحبت و چالش برای تایمر بدون میزبان.</p>
            </div>

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
                بگذار نصف صحبت (
                {toFa(Math.max(MIN_SEC, Math.round(settingsDraft.talkSec / 2)))}ث)
              </button>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section__head">
              <h3>نقشهٔ مأموریت</h3>
              <p>چند بک‌گراند جهان برای صفحهٔ نقشه — عکس فعلی شما نگه داشته می‌شود.</p>
            </div>
            <div className="map-theme-picker" role="listbox" aria-label="بک‌گراند نقشه">
              {MAP_BACKGROUNDS.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  role="option"
                  aria-selected={settingsDraft.mapBg === i}
                  className={`map-theme-picker__swatch ${
                    settingsDraft.mapBg === i ? 'is-active' : ''
                  }`}
                  onClick={() =>
                    setSettingsDraft((s) => ({
                      ...s,
                      mapBg: i as MapBgIndex,
                    }))
                  }
                >
                  <img src={src} alt="" draggable={false} />
                  <span>{toFa(i + 1)}</span>
                </button>
              ))}
            </div>
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
              <h2>راهنمای بازی</h2>
              <button className="link" onClick={() => setShowGuide(false)}>بستن</button>
            </header>
            <div className="guide-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={guideTab === 'rules'}
                className={`guide-tabs__btn ${guideTab === 'rules' ? 'is-active' : ''}`}
                onClick={() => setGuideTab('rules')}
              >
                رول‌بوک
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={guideTab === 'roles'}
                className={`guide-tabs__btn ${guideTab === 'roles' ? 'is-active' : ''}`}
                onClick={() => setGuideTab('roles')}
              >
                نقش‌ها
              </button>
            </div>
            <div className="modal__body">
              {guideTab === 'rules' ? (
                <Rulebook />
              ) : (
                (Object.keys(ROLES) as RoleId[]).map((id) => {
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
                })
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function Rulebook() {
  return (
    <div className="rulebook">
      <section className="rulebook__block">
        <h3>هدف</h3>
        <p>
          شهر باید سه مأموریت را با موفقیت تمام کند. مافیا با سه شکست مأموریت
          (یا پنج رد تیم پشت‌سرهم) برنده می‌شود — مگر اینکه بعد از سه پیروزی شهر،
          اساسین مرلین را درست بزند.
        </p>
      </section>
      <section className="rulebook__block">
        <h3>نوبت لیدر و تیم</h3>
        <p>
          لیدر تعداد لازم برای آن مأموریت را از بازیکنان انتخاب می‌کند. میز با
          رأی شفاهی تیم را قبول یا رد می‌کند. اگر رد شد، شمارندهٔ «رد تیم» را یکی
          بالا ببرید و لیدر عوض می‌شود. پنج رد روی یک مأموریت = پیروزی مافیا.
        </p>
      </section>
      <section className="rulebook__block">
        <h3>کارت مأموریت</h3>
        <p>
          اعضای تیم تأییدشده کارت مخفی می‌دهند. شهر همیشه موفقیت می‌دهد؛ مافیا
          می‌تواند جمجمه بگذارد. معمولاً با یک جمجمه مأموریت می‌سوزد.
        </p>
        <p className="rulebook__callout">
          از ۷ بازیکن به بالا، مأموریت چهارم فقط با <strong>دو جمجمه</strong> شکست
          می‌خورد — یک جمجمه کافی نیست.
        </p>
      </section>
      <section className="rulebook__block">
        <h3>استعلام ساید</h3>
        <p>
          اگر در تنظیمات روشن باشد: اولین استعلام بعد از مأموریت ۲ آزاد می‌شود.
          دارندهٔ توکن ساید یک نفر را می‌پرسد و نتیجه فقط به خودش نشان داده می‌شود؛
          سپس توکن به همان نفر می‌رسد. کسانی که قبلاً استعلام گرفته‌اند دیگر هدف
          نمی‌شوند.
        </p>
      </section>
      <section className="rulebook__block">
        <h3>پایان بازی</h3>
        <ul>
          <li>سه موفقیت مأموریت ← شلیک اساسین؛ اگر مرلین را بزند مافیا می‌برد، وگرنه شهر.</li>
          <li>سه شکست مأموریت ← پیروزی مافیا (بدون شلیک).</li>
          <li>پنج رد تیم ← پیروزی مافیا.</li>
        </ul>
      </section>
      <section className="rulebook__block">
        <h3>اندازه تیم‌ها</h3>
        <p className="rulebook__sizes">
          {[5, 6, 7, 8, 9, 10].map((n) => (
            <span key={n}>
              {toFa(n)}نفر: {(TEAM_SIZES[n] ?? []).map(toFa).join('·')}
              {n >= 7 ? ' (م۴: ۲ جمجمه)' : ''}
            </span>
          ))}
        </p>
      </section>
    </div>
  )
}

function MapStage({
  mode = 'lobby',
  game,
  mapBg,
  inquiryEnabled,
  inquiryReady,
  inquiryHint,
  missionLabel,
  missionDisabled,
  inquiryDisabled,
  leaderName,
  inquiryName,
  leaderLabel,
  leaderDisabled,
  leaderHint,
  timerHint,
  rejectionCount,
  rejectionBumpDisabled,
  rejectionUndoDisabled,
  climax,
  onSettings,
  onGuide,
  onCycleMap,
  onMission,
  onInquiry,
  onLeader,
  onAbilities,
  onTimer,
  onEnd,
  onBumpRejection,
  onUndoRejection,
  onAssassin,
  onDeclareEvil,
}: {
  mode?: 'lobby'
  game: GameState
  mapBg: MapBgIndex
  inquiryEnabled: boolean
  inquiryReady: boolean
  inquiryHint: string
  missionLabel: string
  missionDisabled: boolean
  inquiryDisabled: boolean
  leaderName: string | null
  inquiryName: string | null
  leaderLabel: string
  leaderDisabled: boolean
  leaderHint: string
  timerHint: string
  rejectionCount: number
  rejectionBumpDisabled: boolean
  rejectionUndoDisabled: boolean
  climax: 'assassin' | 'evil' | 'reject' | null
  onSettings: () => void
  onGuide: () => void
  onCycleMap: () => void
  onMission: () => void
  onInquiry: () => void
  onLeader: () => void
  onAbilities: () => void
  onTimer: () => void
  onEnd: () => void
  onBumpRejection: () => void
  onUndoRejection: () => void
  onAssassin: () => void
  onDeclareEvil: () => void
}) {
  const sizes =
    game.missionSizes?.length === 5
      ? game.missionSizes
      : TEAM_SIZES[game.playerCount] ?? []
  const bg = MAP_BACKGROUNDS[mapBg] ?? MAP_BACKGROUNDS[0]

  return (
    <section className={`map-stage map-stage--${mode} fade-in`} aria-label="میز بازی">
      <img className="map-stage__bg" src={bg} alt="" draggable={false} />
      <div className="map-stage__shade" aria-hidden />

      <header className="map-stage__top">
        <button type="button" className="map-stage__close" onClick={onSettings}>
          تنظیمات
        </button>
        <p className="map-stage__mark">آوالون</p>
        <div className="map-stage__top-actions">
          <button type="button" className="map-stage__close" onClick={onCycleMap}>
            نقشه
          </button>
          <button type="button" className="map-stage__close" onClick={onGuide}>
            راهنما
          </button>
        </div>
      </header>

      <div className="map-stage__field">
        <div className="map-stage__trail" aria-hidden>
          <span className="map-stage__trail-line" />
        </div>
        <div className="map-stage__missions" aria-label="مأموریت‌ها">
          {game.missions.map((status, i) => {
            const twoFails = needsTwoFails(game.playerCount, i)
            const current =
              i === game.currentMission && game.phase === 'play'
            return (
              <div
                key={i}
                className={`map-token ${status} ${current ? 'is-current' : ''} ${
                  twoFails ? 'needs-two' : ''
                }`}
              >
                <div className="map-token__socket" aria-hidden>
                  <span className="map-token__rim" />
                  <span className="map-token__glow" />
                </div>
                <div className="map-token__gem">
                  <img
                    className="map-token__art"
                    src={
                      status === 'success'
                        ? '/missions/success.jpg'
                        : status === 'fail'
                          ? '/missions/fail.jpg'
                          : '/missions/pending.jpg'
                    }
                    alt=""
                    draggable={false}
                  />
                  {status === 'pending' && (
                    <span className="map-token__num">{toFa(i + 1)}</span>
                  )}
                </div>
                <div className="map-token__labels">
                  <span className="map-token__meta">
                    {toFa(sizes[i] ?? 0)} نفر
                  </span>
                  {twoFails && <span className="map-token__two">۲ جمجمه</span>}
                  {status === 'success' && (
                    <span className="map-token__result is-good">پیروز</span>
                  )}
                  {status === 'fail' && (
                    <span className="map-token__result is-evil">شکست</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {climax === 'assassin' && (
          <div className="map-climax is-shot">
            <p>شهر سه مأموریت برد</p>
            <h3>شلیک اساسین</h3>
            <button type="button" className="btn btn--primary" onClick={onAssassin}>
              شروع شلیک
            </button>
          </div>
        )}

        {(climax === 'evil' || climax === 'reject') && (
          <div className="map-climax is-evil">
            <p>{climax === 'reject' ? '۵ بار رد تیم' : 'سه مأموریت شکست'}</p>
            <h3>مافیا میز را برد</h3>
            <button type="button" className="btn btn--primary" onClick={onDeclareEvil}>
              اعلام پیروزی مافیا
            </button>
          </div>
        )}

        <div className="map-stage__dock">
          {(leaderName || inquiryName) && (
            <div className="map-stage__status">
              {leaderName && (
                <div className="map-chip">
                  <span>لیدر</span>
                  <strong>{leaderName}</strong>
                </div>
              )}
              {inquiryName && (
                <div className="map-chip">
                  <span>استعلام</span>
                  <strong>{inquiryName}</strong>
                </div>
              )}
            </div>
          )}
          <div className="map-dash">
            <button
              type="button"
              className="map-action"
              onClick={onLeader}
              disabled={leaderDisabled}
            >
              <span className="map-action__label">{leaderLabel}</span>
              <span className="map-action__desc">{leaderHint}</span>
            </button>
            <button type="button" className="map-action" onClick={onAbilities}>
              <span className="map-action__label">نقش و توانایی</span>
              <span className="map-action__desc">نقش و یارها</span>
            </button>
            {inquiryEnabled && (
              <button
                type="button"
                className={`map-action ${inquiryReady ? 'is-ready' : ''}`}
                onClick={onInquiry}
                disabled={inquiryDisabled}
              >
                <span className="map-action__label">استعلام</span>
                <span className="map-action__desc">{inquiryHint}</span>
              </button>
            )}
            <button
              type="button"
              className="map-action"
              onClick={onMission}
              disabled={missionDisabled}
            >
              <span className="map-action__label">{missionLabel}</span>
              <span className="map-action__desc">خورشید / جمجمه</span>
            </button>
            <button type="button" className="map-action" onClick={onTimer}>
              <span className="map-action__label">تایمر</span>
              <span className="map-action__desc">{timerHint}</span>
            </button>
            <button
              type="button"
              className="map-action map-action--danger"
              onClick={onEnd}
            >
              <span className="map-action__label">پایان بازی</span>
              <span className="map-action__desc">افشای نقش‌ها</span>
            </button>
          </div>

          <div className="map-stage__reject" aria-label="رد تیم">
            <div className="map-stage__reject-head">
              <p>رد پیشنهاد تیم</p>
              <strong>
                {rejectionCount === 0 ? 'خالی' : `${toFa(rejectionCount)} از ۵`}
              </strong>
            </div>
            <div className="map-stage__reject-row">
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className={`map-reject ${rejectionCount >= n ? 'is-on' : ''} ${
                    n === 5 ? 'is-fatal' : ''
                  }`}
                >
                  {toFa(n)}
                </span>
              ))}
            </div>
            <div className="map-stage__reject-actions">
              <button
                type="button"
                className="map-stage__close"
                onClick={onBumpRejection}
                disabled={rejectionBumpDisabled}
              >
                تیم رأی نیاورد
              </button>
              <button
                type="button"
                className="map-stage__close"
                onClick={onUndoRejection}
                disabled={rejectionUndoDisabled}
              >
                یکی کم کن
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
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

function MissionBoard({
  game,
  onExpand,
}: {
  game: GameState
  large?: boolean
  onExpand?: () => void
}) {
  const sizes =
    game.missionSizes?.length === 5
      ? game.missionSizes
      : TEAM_SIZES[game.playerCount] ?? []

  const board = (
    <div className="quest-board" aria-label="تخته مأموریت‌ها">
      <div className="quest-board__veil" aria-hidden />
      <div className="quest-board__missions">
        {game.missions.map((status, i) => {
          const twoFails = needsTwoFails(game.playerCount, i)
          return (
            <div
              key={i}
              className={`quest-seal ${status} ${
                i === game.currentMission && game.phase === 'play' ? 'is-current' : ''
              } ${twoFails ? 'needs-two' : ''}`}
            >
              <div className="quest-seal__ring">
                <img
                  className="quest-seal__art"
                  src={
                    status === 'success'
                      ? '/missions/success.jpg'
                      : status === 'fail'
                        ? '/missions/fail.jpg'
                        : '/missions/pending.jpg'
                  }
                  alt=""
                  draggable={false}
                />
                {status === 'pending' && (
                  <span className="quest-seal__n">{toFa(i + 1)}</span>
                )}
              </div>
              <span className="quest-seal__size">{toFa(sizes[i] ?? 0)} نفر</span>
              {twoFails && (
                <span className="quest-seal__two" title="برای سوختن این مأموریت دو کارت جمجمه لازم است">
                  ۲ جمجمه
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  if (!onExpand) return board

  return (
    <button
      type="button"
      className="mission-board-wrap"
      onClick={onExpand}
      aria-label="بزرگ‌نمایی نقشه مأموریت‌ها"
    >
      {board}
      <span className="mission-board-wrap__hint">برای نقشهٔ کامل ضربه بزن</span>
    </button>
  )
}

function SunIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
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

function SkullIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
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
