import { readFile } from 'node:fs/promises'
import { Chess } from 'chess.js'

const puzzles = JSON.parse(await readFile('src/data/puzzles.json', 'utf8'))
if (puzzles.length !== 500) throw new Error(`Le lot doit contenir 500 puzzles, pas ${puzzles.length}`)

function countPieces(fen) {
  return [...fen.split(' ')[0]].filter((character) => /[prnbqkPRNBQK]/.test(character)).length
}

function uciToMove(uci) {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    ...(uci[4] ? { promotion: uci[4] } : {}),
  }
}

for (const puzzle of puzzles) {
  const game = new Chess(puzzle.fen)
  for (const uci of puzzle.moves) game.move(uciToMove(uci))
  if (!game.isCheckmate()) throw new Error(`Le puzzle ${puzzle.id} ne finit pas par un mat`)
  if (puzzle.mateIn === 1 && puzzle.moves.length !== 1) throw new Error(`Longueur invalide pour ${puzzle.id}`)
  if (puzzle.mateIn === 2 && puzzle.moves.length !== 3) throw new Error(`Longueur invalide pour ${puzzle.id}`)
  if (!puzzle.themes.includes('mateIn2')) throw new Error(`Thème mateIn2 absent pour ${puzzle.id}`)
  if (puzzle.pieceCount !== countPieces(puzzle.fen) || puzzle.pieceCount < 3 || puzzle.pieceCount > 10) {
    throw new Error(`Nombre de pièces invalide pour ${puzzle.id}`)
  }
}

console.log(`${puzzles.length} puzzles valides`)
