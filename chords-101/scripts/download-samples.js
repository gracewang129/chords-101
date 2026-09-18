// Downloads piano sample mp3s (C4..B5) into public/samples
import fs from 'fs'
import https from 'https'
import { mkdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

// use flat names for accidentals because the SoundFont repo uses flats (Db, Eb, Gb, Ab, Bb)
const notes = []
const semitones = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
for (let oct = 4; oct <= 5; oct++) {
  for (const s of semitones) {
    notes.push(`${s}${oct}`)
  }
}

const base = 'https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/master/FluidR3_GM/acoustic_grand_piano-mp3'
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(scriptDir, '..', 'public', 'samples')

async function main(){
  await mkdir(outDir, { recursive: true })
  for (const n of notes) {
    const fileName = `${n}.mp3`
    const url = `${base}/${fileName}`
    const outPath = path.join(outDir, fileName)
    if (fs.existsSync(outPath)) {
      console.log('exists', fileName)
      continue
    }
    console.log('download', url)
    await new Promise((resolve, reject) => {
      const req = https.get(url, (res) => {
        if (res.statusCode !== 200) {
          console.error('failed', fileName, res.statusCode)
          res.resume()
          return resolve(null)
        }
        const file = fs.createWriteStream(outPath)
        res.pipe(file)
        file.on('finish', () => file.close(resolve))
        file.on('error', reject)
      })
      req.on('error', reject)
    })
  }
}

main().catch((e)=>{ console.error(e); process.exit(1) })
