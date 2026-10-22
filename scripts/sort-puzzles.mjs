import { readFile, writeFile } from 'node:fs/promises'

const path = 'src/data/puzzles.json'
const puzzles = JSON.parse(await readFile(path, 'utf8'))

function order(id) {
  let hash = 2166136261
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return hash >>> 0
}

puzzles.sort((a, b) => order(a.id) - order(b.id))
await writeFile(path, `${JSON.stringify(puzzles, null, 2)}\n`)
console.log(`Mélangé ${puzzles.length} puzzles sans tri par difficulté`)
