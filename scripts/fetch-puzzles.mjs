import { mkdir, writeFile } from 'node:fs/promises'
import { zstdDecompressSync } from 'node:zlib'
import { Chess } from 'chess.js'

const SOURCE_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst'
const TARGET = 500
const MIN_PIECES = 3
const MAX_PIECES = 10
const candidates = []

function uciToMove(uci) {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    ...(uci[4] ? { promotion: uci[4] } : {}),
  }
}

function moveKey(move) {
  return `${move.from}${move.to}${move.promotion ?? ''}`
}

function squareIndex(square) {
  return (8 - Number(square[1])) * 8 + square.charCodeAt(0) - 97
}

function boardFromFen(fen) {
  const board = []
  let index = 0
  for (const character of fen.split(' ')[0]) {
    if (character === '/') continue
    if (/\d/.test(character)) {
      index += Number(character)
      continue
    }
    board[index] = character
    index += 1
  }
  return board
}

function countPiecesAfterFirstMove(fen, uci) {
  const [placement, , , enPassant] = fen.split(' ')
  const board = boardFromFen(fen)
  const from = squareIndex(uci.slice(0, 2))
  const to = squareIndex(uci.slice(2, 4))
  const movingPiece = board[from]
  const isEnPassant = movingPiece?.toLowerCase() === 'p' && !board[to] && enPassant === uci.slice(2, 4)
  const captured = Boolean(board[to]) || isEnPassant
  const pieceCount = [...placement].filter((character) => /[prnbqkPRNBQK]/.test(character)).length
  return pieceCount - (captured ? 1 : 0)
}

function preparePuzzle(candidate) {
  const moves = candidate.movesText.split(' ').filter(Boolean)
  if (moves.length !== 4) return null

  try {
    const position = new Chess(candidate.fen)
    position.move(uciToMove(moves[0]))
    const firstSolution = moves[1]
    const isLegal = position.moves({ verbose: true }).some((move) => moveKey(move) === firstSolution)
    if (!isLegal) return null

    for (const uci of moves.slice(1)) position.move(uciToMove(uci))
    if (!position.isCheckmate()) return null

    const puzzleFen = new Chess(candidate.fen)
    puzzleFen.move(uciToMove(moves[0]))

    return {
      id: candidate.id,
      fen: puzzleFen.fen(),
      moves: moves.slice(1),
      rating: candidate.rating,
      pieceCount: candidate.pieceCount,
      themes: candidate.themes,
      mateIn: 2,
      source: `https://lichess.org/training/${candidate.id}`,
    }
  } catch {
    return null
  }
}

console.log('Téléchargement de la base officielle Lichess…')
const response = await fetch(SOURCE_URL)
if (!response.ok || !response.body) throw new Error(`Impossible de télécharger la base Lichess (${response.status})`)

const compressed = Buffer.from(await response.arrayBuffer())
const seekableFrames = []
for (let index = 0; index <= compressed.length - 4; index += 1) {
  if (compressed[index] !== 0x50 || compressed[index + 1] !== 0x2a || compressed[index + 2] !== 0x4d || compressed[index + 3] !== 0x18) continue
  const metadataLength = compressed.readUInt32LE(index + 4)
  seekableFrames.push({ marker: index, start: index + 8 + metadataLength, end: 0 })
}
for (let index = 0; index < seekableFrames.length; index += 1) {
  seekableFrames[index].end = seekableFrames[index + 1]?.marker ?? compressed.length
}

let scanned = 0
let remainder = ''

function processLine(rawLine) {
  const line = rawLine.trimEnd()
  if (!line || line.startsWith('PuzzleId,')) return
  scanned += 1

  const [id, fen, movesText, ratingText, , , , themesText] = line.split(',', 8)
  const themes = themesText?.split(' ') ?? []
  if (!id || !fen || !movesText || !themes.includes('mateIn2')) return

  const firstMove = movesText.split(' ')[0]
  const pieceCount = countPiecesAfterFirstMove(fen, firstMove)
  if (pieceCount < MIN_PIECES || pieceCount > MAX_PIECES) return

  candidates.push({
    id,
    fen,
    movesText,
    rating: Number(ratingText),
    pieceCount,
    themes,
  })
}

for (const frame of seekableFrames) {
  const text = zstdDecompressSync(compressed.subarray(frame.start, frame.end)).toString('utf8')
  const lines = `${remainder}${text}`.split('\n')
  remainder = lines.pop() ?? ''
  for (const line of lines) processLine(line)
  if (scanned % 1_000_000 === 0) console.log(`${scanned.toLocaleString('fr-FR')} lignes parcourues · ${candidates.length} candidats`)
}
if (remainder) processLine(remainder)

console.log(`${scanned.toLocaleString('fr-FR')} puzzles parcourus · ${candidates.length} candidats entre ${MIN_PIECES} et ${MAX_PIECES} pièces`)

const puzzles = []
const seen = new Set()
for (const candidate of candidates) {
  if (seen.has(candidate.id)) continue
  const puzzle = preparePuzzle(candidate)
  if (!puzzle) continue
  seen.add(candidate.id)
  puzzles.push(puzzle)
  if (puzzles.length === TARGET) break
}

if (puzzles.length !== TARGET) {
  throw new Error(`Seulement ${puzzles.length} puzzles valides trouvés sur ${TARGET}`)
}

await mkdir('src/data', { recursive: true })
await writeFile('src/data/puzzles.json', `${JSON.stringify(puzzles, null, 2)}\n`)
console.log(`Écrit ${puzzles.length} puzzles dans src/data/puzzles.json`)
