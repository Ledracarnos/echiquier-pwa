import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Chess, type Move } from 'chess.js'
import { Chessground } from 'chessground'
import type { Api } from 'chessground/api'
import type { Config } from 'chessground/config'
import type { Dests, Key } from 'chessground/types'
import puzzlesData from './data/puzzles.json'
import 'chessground/assets/chessground.base.css'
import 'chessground/assets/chessground.cburnett.css'
import './App.css'

type Puzzle = {
  id: string
  fen: string
  moves: string[]
  rating: number
  themes: string[]
  mateIn: 1 | 2
  source: string
}

const puzzles = puzzlesData as Puzzle[]
const confettiColors = ['#a9d8b4', '#e0c16b', '#d88e76', '#7ab3c7', '#e0e7d7']
const completedStorageKey = 'echiquier-completed-puzzles'

function getLegalDests(game: Chess): Dests {
  const dests: Dests = new Map()
  for (const move of game.moves({ verbose: true }) as Move[]) {
    const from = move.from as Key
    const to = move.to as Key
    dests.set(from, [...(dests.get(from) ?? []), to])
  }
  return dests
}

function getLastMove(game: Chess): Key[] | undefined {
  const lastMove = game.history({ verbose: true }).at(-1) as Move | undefined
  return lastMove ? [lastMove.from as Key, lastMove.to as Key] : undefined
}

function getMoveKey(orig: Key, dest: Key, promotion?: string) {
  return `${orig}${dest}${promotion ?? ''}`
}

function getGameStatus(inCheck: boolean, thinking: boolean, solved: boolean, mistake: boolean) {
  if (solved) return 'Casse-tête réussi !'
  if (mistake) return 'Pas ce coup-là'
  if (thinking) return 'La défense cherche…'
  if (inCheck) return 'À vous — échec'
  return 'À vous de jouer'
}

function StarIcon({ filled }: { filled: boolean }) {
  const path = 'M12 2.75l2.84 5.76 6.36.92-4.6 4.48 1.09 6.33L12 17.25 6.31 20.24 7.4 13.91 2.8 9.43l6.36-.92L12 2.75z'
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 1 : 1.35} strokeLinejoin="round" />
    </svg>
  )
}

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  const path = direction === 'left' ? 'M19 12H5M11 6l-6 6 6 6' : 'M5 12h14M13 6l6 6-6 6'
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 4v4h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function App() {
  const boardRef = useRef<HTMLDivElement>(null)
  const boardApiRef = useRef<Api | null>(null)
  const gameRef = useRef(new Chess(puzzles[0].fen))
  const solutionIndexRef = useRef(0)
  const initialPlayerColor = puzzles[0].fen.split(' ')[1] as 'w' | 'b'
  const playerColorRef = useRef<'w' | 'b'>(initialPlayerColor)
  const defenseTimerRef = useRef<number | undefined>(undefined)
  const [puzzleIndex, setPuzzleIndex] = useState(0)
  const [positionVersion, setPositionVersion] = useState(0)
  const [inCheck, setInCheck] = useState(false)
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>(initialPlayerColor)
  const [thinking, setThinking] = useState(false)
  const [solved, setSolved] = useState(false)
  const [mistake, setMistake] = useState(false)
  const [canRestart, setCanRestart] = useState(false)
  const [showStatus, setShowStatus] = useState(true)
  const [completedPuzzles, setCompletedPuzzles] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      return new Set(JSON.parse(window.localStorage.getItem(completedStorageKey) ?? '[]'))
    } catch {
      return new Set()
    }
  })

  const puzzle = puzzles[puzzleIndex]
  const isCompleted = completedPuzzles.has(puzzle.id)
  const status = getGameStatus(inCheck, thinking, solved, mistake)
  const statusKey = `${puzzleIndex}-${status}-${mistake}-${solved}-${thinking}`
  const statusText = solved
    ? '✓ MAT !'
    : mistake
      ? 'ESSAYEZ ENCORE'
      : status === 'À vous de jouer'
        ? 'À VOUS DE JOUER !'
        : status.toUpperCase()

  const refresh = () => {
    setInCheck(gameRef.current.isCheck())
    setPositionVersion((version) => version + 1)
  }

  const syncBoard = () => {
    const currentGame = gameRef.current
    const api = boardApiRef.current
    if (!api) return

    const config: Config = {
      fen: currentGame.fen(),
      orientation: playerColorRef.current === 'w' ? 'white' : 'black',
      turnColor: currentGame.turn() === 'w' ? 'white' : 'black',
      lastMove: getLastMove(currentGame),
      animation: { enabled: false },
      movable: {
        free: false,
        color: playerColorRef.current === 'w' ? 'white' : 'black',
        dests: getLegalDests(currentGame),
        showDests: true,
        events: { after: (orig, dest) => handlePlayerMove(orig, dest) },
      },
    }
    api.set(config)
  }

  const playDefense = () => {
    const currentPuzzle = puzzles[puzzleIndex]
    const currentGame = gameRef.current
    const defense = currentPuzzle.moves[solutionIndexRef.current]
    if (!defense || currentGame.isGameOver()) {
      setThinking(false)
      refresh()
      return
    }

    currentGame.move({
      from: defense.slice(0, 2),
      to: defense.slice(2, 4),
      promotion: defense[4] ?? 'q',
    })
    solutionIndexRef.current += 1
    setThinking(false)
    refresh()
  }

  const handlePlayerMove = (orig: Key, dest: Key) => {
    const currentPuzzle = puzzles[puzzleIndex]
    const expected = currentPuzzle.moves[solutionIndexRef.current]
    if (thinking || solved || gameRef.current.turn() !== playerColorRef.current || !expected) {
      syncBoard()
      return
    }

    const expectedBase = expected.slice(0, 4)
    if (getMoveKey(orig, dest) !== expectedBase) {
      setMistake(true)
      refresh()
      return
    }

    try {
      gameRef.current.move({
        from: orig,
        to: dest,
        promotion: expected[4] ?? 'q',
      })
    } catch {
      setMistake(true)
      refresh()
      return
    }

    setMistake(false)
    setCanRestart(true)
    solutionIndexRef.current += 1

    if (solutionIndexRef.current >= currentPuzzle.moves.length) {
      setSolved(true)
      setCompletedPuzzles((completed) => {
        const nextCompleted = new Set(completed)
        nextCompleted.add(currentPuzzle.id)
        window.localStorage.setItem(completedStorageKey, JSON.stringify([...nextCompleted]))
        return nextCompleted
      })
      refresh()
      return
    }

    setThinking(true)
    defenseTimerRef.current = window.setTimeout(playDefense, 420)
    refresh()
  }

  const loadPuzzle = (nextIndex: number) => {
    if (defenseTimerRef.current) window.clearTimeout(defenseTimerRef.current)
    const safeIndex = (nextIndex + puzzles.length) % puzzles.length
    const nextPuzzle = puzzles[safeIndex]
    gameRef.current = new Chess(nextPuzzle.fen)
    playerColorRef.current = gameRef.current.turn()
    setPlayerColor(gameRef.current.turn())
    solutionIndexRef.current = 0
    setPuzzleIndex(safeIndex)
    setThinking(false)
    setSolved(false)
    setMistake(false)
    setCanRestart(false)
    refresh()
  }

  // Chessground is intentionally mounted once; its callbacks read the current refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!boardRef.current) return
    boardApiRef.current = Chessground(boardRef.current, {
      fen: gameRef.current.fen(),
      orientation: playerColorRef.current === 'w' ? 'white' : 'black',
      coordinates: true,
      coordinatesOnSquares: true,
      animation: { enabled: false },
      highlight: { lastMove: true, check: true },
      movable: {
        free: false,
        color: playerColorRef.current === 'w' ? 'white' : 'black',
        dests: getLegalDests(gameRef.current),
        showDests: true,
        events: { after: (orig, dest) => handlePlayerMove(orig, dest) },
      },
      draggable: { enabled: true, showGhost: true },
      blockTouchScroll: true,
    })

    return () => {
      boardApiRef.current?.destroy()
      boardApiRef.current = null
    }
  }, [])

  // Sync the imperative board after each puzzle state change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    syncBoard()
  }, [positionVersion, thinking, solved, mistake, puzzleIndex])

  useEffect(() => {
    return () => {
      if (defenseTimerRef.current) window.clearTimeout(defenseTimerRef.current)
    }
  }, [])

  useEffect(() => {
    setShowStatus(true)
    const timer = window.setTimeout(() => setShowStatus(false), 1500)
    return () => window.clearTimeout(timer)
  }, [statusKey])

  const theme = puzzle.mateIn === 1 ? 'MAT EN 1' : 'MAT EN 2'

  return (
    <main className="minimal-app">
      <header className="minimal-header">
        <div className="minimal-counter">
          <span>{String(puzzleIndex + 1).padStart(3, '0')}/{puzzles.length}</span>
          <span className="minimal-puzzle-type">
            <span>{theme}</span>
            <span aria-hidden="true">·</span>
            <span>{playerColor === 'w' ? 'BLANCS' : 'NOIRS'}</span>
          </span>
        </div>
      </header>

      <section className="minimal-stage" aria-label="Casse-tête d’échecs">
        <div className="board-frame">
          <div className="board" ref={boardRef} />
          <span
            key={statusKey}
            className={`board-status-overlay ${mistake ? 'is-error' : solved ? 'is-success' : ''} ${showStatus ? 'is-visible' : 'is-hidden'}`}
          >
            {statusText}
          </span>
        </div>

        {solved && (
          <div className="confetti-layer" aria-hidden="true">
            {Array.from({ length: 28 }, (_, index) => (
              <i
                className="confetti-dot"
                key={index}
                style={{
                  '--left': `${(index * 37) % 101}%`,
                  '--drift': `${((index * 29) % 80) - 40}px`,
                  backgroundColor: confettiColors[index % confettiColors.length],
                  animationDelay: `${(index % 8) * 70}ms`,
                  animationDuration: `${2.2 + (index % 5) * 0.18}s`,
                } as CSSProperties}
              />
            ))}
          </div>
        )}

        <div className="minimal-footer">
          <span className={`completion-star ${isCompleted ? 'is-earned' : 'is-empty'}`} aria-label={isCompleted ? 'Puzzle déjà réussi' : 'Puzzle non terminé'}>
            <StarIcon filled={isCompleted} />
          </span>
          <div className="minimal-actions">
            <button className="minimal-button" type="button" onClick={() => loadPuzzle(puzzleIndex - 1)} disabled={puzzleIndex === 0} aria-label="Puzzle précédent" title="Puzzle précédent"><ArrowIcon direction="left" /></button>
            <button className="minimal-button" type="button" onClick={() => loadPuzzle(puzzleIndex)} disabled={!canRestart} aria-label="Recommencer le puzzle" title="Recommencer"><ResetIcon /></button>
            <button className="minimal-button minimal-next" type="button" onClick={() => isCompleted && loadPuzzle(puzzleIndex + 1)} disabled={!isCompleted} aria-label="Puzzle suivant" title="Puzzle suivant"><ArrowIcon direction="right" /></button>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
