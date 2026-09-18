import { useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'

const SEMITONES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']

// mapping for both sharps and flats to semitone index
const NOTE_INDEX: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1,
  D: 2, 'D#': 3, Eb: 3,
  E: 4, Fb: 4,
  F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8,
  A: 9, 'A#': 10, Bb: 10,
  B: 11, Cb: 11,
}

const SHARP_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

function noteToMidiGeneric(note: string) {
  // accepts C4, C#4, Db4
  const m = note.match(/^([A-G](?:#|b)?)(-?\d+)$/)
  if (!m) return 60
  const name = m[1]
  const octave = parseInt(m[2], 10)
  const index = NOTE_INDEX[name]
  if (index === undefined) return 60
  return (octave + 1) * 12 + index
}

function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

function toSharpName(noteWithOctave: string) {
  // return the note name (no octave) in sharps where applicable
  const m = noteWithOctave.match(/^([A-G](?:#|b)?)(-?\d+)?$/)
  if (!m) return noteWithOctave
  const name = m[1]
  // map flats to preferred sharp names
  const flatToSharp: Record<string, string> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' }
  if (flatToSharp[name]) return flatToSharp[name]
  return name
}

export default function ChordToSound() {
  const [active, setActive] = useState<Record<string, boolean>>({})
  const samplerRef = useRef<any>(null)
  const synthRef = useRef<any>(null)
  const startedRef = useRef(false)
  const sampleNotesRef = useRef<string[]>([])
  const [samplesLoaded, setSamplesLoaded] = useState(false)
  const [shownNotes, setShownNotes] = useState<string[]>([])
  const hideTimeoutRef = useRef<number | null>(null)
  const [currentChord, setCurrentChord] = useState('');
  const [root, setRoot] = useState('C')
  const [selectedChordIdx, setSelectedChordIdx] = useState<number | null>(null)

  // generate two octaves: C4..B5
  const notes: string[] = []
  // expand to three octaves: C4..B6
  for (let oct = 4; oct <= 6; oct++) {
    for (const s of SEMITONES) {
      notes.push(`${s}${oct}`)
    }
  }

  const whiteNotes = notes.filter((n) => !n.match(/[b#]/))
  const blackNotes = notes
    .map((n, i) => ({ note: n, index: i }))
    .filter((x) => x.note.match(/[b#]/))

  const keyWidth = 40

  useEffect(() => {
    // create a sampler mapping for all displayed notes (C4..B5) so samples are preferred
    // Use local samples in public/samples if available
    const base = '/samples'
    const samples: Record<string, string> = {}
    // Prefer natural note samples (C,D,E,F,G,A,B). Sampler will pitch-shift these for sharps.
    for (const n of notes) {
      if (!n.includes('b')) {
        samples[n] = `${base}/${n}.mp3`
      }
    }

    samplerRef.current = new Tone.Sampler(samples).toDestination()
    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0.2, release: 0.5 },
    }).toDestination()

    sampleNotesRef.current = Object.keys(samples)

    // wait for sampler to load its buffers (Tone.Sampler may expose a Promise)
    try {
      const p = samplerRef.current?.loaded
      if (p && typeof p.then === 'function') {
        p.then(() => setSamplesLoaded(true)).catch(() => setSamplesLoaded(true))
      } else {
        // if no promise, assume immediate availability
        setSamplesLoaded(true)
      }
    } catch {
      setSamplesLoaded(true)
    }

    return () => {
      try {
        samplerRef.current?.dispose()
      } catch {}
      try {
        synthRef.current?.dispose()
      } catch {}
    }
  }, [])

  async function startNote(note: string, durationMs = 600) {
    if (!startedRef.current) {
      try {
        await Tone.start()
      } catch {}
      startedRef.current = true
    }
    const duration = `${Math.max(50, durationMs)}ms`
    const hasSample = samplesLoaded
    // find canonical key name used in the keyboard (notes array) by matching MIDI
    const canonical = notes.find((n) => noteToMidiGeneric(n) === noteToMidiGeneric(note)) || note
    setActive((s) => ({ ...s, [canonical]: true }))
    if (hasSample) {
      try {
        samplerRef.current.triggerAttackRelease(note, duration)
      } catch {
        synthRef.current.triggerAttackRelease(note, duration)
      }
    } else {
      synthRef.current.triggerAttackRelease(note, duration)
    }
    // clear highlight after duration (use canonical key)
    setTimeout(() => setActive((s) => ({ ...s, [canonical]: false })), durationMs + 20)
  }

  // legacy stopNote kept for sequences using explicit stop (not used now)
  function stopNote(note: string) {
    // release both sampler/synth and clear canonical active key
    try {
      samplerRef.current.triggerRelease?.(note)
    } catch {}
    try {
      synthRef.current.triggerRelease?.(note)
    } catch {}
    const canonical = notes.find((n) => noteToMidiGeneric(n) === noteToMidiGeneric(note)) || note
    setActive((s) => ({ ...s, [canonical]: false }))
  }

  // convert midi number back to note string (use sharps)
  function midiToNoteName(midi: number) {
    const idx = ((midi % 12) + 12) % 12
    const oct = Math.floor(midi / 12) - 1
    return `${SHARP_NAMES[idx]}${oct}`
  }

  function rootIndexFromLabel(lbl: string) {
    const base = lbl.replace(/\d+$/, '')
    if (NOTE_INDEX[base] !== undefined) return NOTE_INDEX[base]
    // handle some enharmonic labels user may pick
    if (base === 'B#') return NOTE_INDEX['C']
    if (base === 'E#') return NOTE_INDEX['F']
    return NOTE_INDEX['E']
  }

  function transposeNote(note: string, semitoneShift: number) {
    const midi = noteToMidiGeneric(note)
    const newMidi = midi + semitoneShift
    return midiToNoteName(newMidi)
  }

  // handlers for pointer interactions
  function handlePointerDown(note: string) {
    return (e: any) => {
      startNote(note)
    }
  }

  function handlePointerUp(note: string) {
    return (e: any) => {
      stopNote(note)
    }
  }

  const pianoWidth = whiteNotes.length * keyWidth
  // chord definitions (E-root templates). Each item contains a type label and notes defined for root=E.
  const chords = [
    {
      nameCN: '属七和弦',
      englishLong: 'Dominant 7th',
      englishShort: '7',
      triad: ['E4', 'G#4', 'B4'],
      seventh: ['E4', 'G#4', 'B4', 'D5'],
    },
    {
      nameCN: '大七和弦',
      englishLong: 'Major 7th',
      englishShort: 'maj7',
      triad: ['E4', 'G#4', 'B4'],
      seventh: ['E4', 'G#4', 'B4', 'D#5'],
    },
    {
      nameCN: '小七和弦',
      englishLong: 'Minor 7th',
      englishShort: 'm7',
      triad: ['E4', 'G4', 'B4'],
      seventh: ['E4', 'G4', 'B4', 'D5'],
    },
    {
      nameCN: '小大七和弦',
      englishLong: 'Minor Major 7th',
      englishShort: 'm(maj7)',
      triad: ['E4', 'G4', 'B4'],
      seventh: ['E4', 'G4', 'B4', 'D#5'],
    },
    {
      nameCN: '半减七 / 小七减五',
      englishLong: 'Half-Diminished',
      englishShort: 'ø7',
      triad: ['E4', 'G4', 'Bb4'],
      seventh: ['E4', 'G4', 'Bb4', 'D5'],
    },
    {
      nameCN: '减七和弦',
      englishLong: 'Diminished 7th',
      englishShort: '°7',
      triad: ['E4', 'G4', 'Bb4'],
      seventh: ['E4', 'G4', 'Bb4', 'C#5'],
    },
    {
      nameCN: '增七和弦',
      englishLong: 'Augmented 7th',
      englishShort: '7#5',
      triad: ['E4', 'G#4', 'C5'],
      seventh: ['E4', 'G#4', 'C5', 'D5'],
    },
    {
      nameCN: '增大大七和弦',
      englishLong: 'Augmented Major 7th',
      englishShort: 'maj7#5',
      triad: ['E4', 'G#4', 'C5'],
      seventh: ['E4', 'G#4', 'C5', 'D#5'],
    },
  ]

  function playChordSequence(notesArr: string[], noteDuration = 360, gap = 120) {
    if (!notesArr || notesArr.length === 0) return
    // compute semitone shift from base root 'E' to selected root
    const shift = rootIndexFromLabel(root) - NOTE_INDEX['E']
    const transposed = notesArr.map((n) => transposeNote(n, shift))
    setShownNotes(transposed)
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    let t = 0
    for (const n of transposed) {
      window.setTimeout(() => startNote(n, noteDuration), t)
      t += noteDuration + gap
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, minWidth: 56 }}>根音:</span>
          {( ['A','A#','B','B#','C','C#','D','D#','E','E#','F','F3','G','G3'] ).map((opt) => {
            const isSelected = opt === root
            return (
              <button
                key={opt}
                onClick={() => {
                  const newRoot = opt
                  setRoot(newRoot)
                  // maintain selected chord type if any
                  if (selectedChordIdx !== null && chords[selectedChordIdx]) {
                    const c = chords[selectedChordIdx]
                    const sourceNotes = c.seventh ?? c.triad
                    const shift = rootIndexFromLabel(newRoot) - NOTE_INDEX['E']
                    const transposedForTitle = sourceNotes.map((n: string) => transposeNote(n, shift))
                    const englishText = `${newRoot} ${c.englishLong} / ${newRoot}${c.englishShort}`
                    const title = `${c.nameCN} (${englishText})：${transposedForTitle.join(' - ')}`
                    setCurrentChord(title)
                    if (hideTimeoutRef.current) {
                      window.clearTimeout(hideTimeoutRef.current)
                      hideTimeoutRef.current = null
                    }
                    setShownNotes(transposedForTitle)
                  } else {
                    setCurrentChord('')
                  }
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: isSelected ? '#1976d2' : '#f5f5f5',
                  color: isSelected ? 'white' : '#222',
                  boxShadow: isSelected ? '0 3px 6px rgba(25,118,210,0.3)' : '0 1px 3px rgba(0,0,0,0.08)',
                  fontWeight: 600,
                }}
              >
                {opt}
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        {chords.map((c, idx) => {
          const sourceNotes = c.seventh ?? c.triad
          const shift = rootIndexFromLabel(root) - NOTE_INDEX['E']
          const transposedForTitle = sourceNotes.map((n: string) => transposeNote(n, shift))
          const englishText = `${root} ${c.englishLong} / ${root}${c.englishShort}`
          const title = `${c.nameCN} (${englishText})：${transposedForTitle.join(' - ')}`
          return (
              <div key={`chord-${idx}`} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{title}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChordIdx(idx)
                    setCurrentChord(title)
                    playChordSequence(sourceNotes)
                  }}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#1976d2',
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 6px 10px rgba(25,118,210,0.18)'
                  }}
                >
                  Play
                </button>
              </div>
          )
        })}
        <span style={{ marginLeft: 12 }}>{samplesLoaded ? 'Samples ready' : 'Loading samples...'}</span>
      </div>
      <h2>{currentChord}</h2>
      <div className="piano" style={{ width: pianoWidth }}>
        <div className="white-keys">
          {whiteNotes.map((k) => {
            const label = toSharpName(k.replace(/\d+$/, ''))
            const showLabel = shownNotes.some((s) => noteToMidiGeneric(s) === noteToMidiGeneric(k))
            return (
              <div
                key={k}
                role="button"
                tabIndex={0}
                className={`white-key ${active[k] ? 'active' : ''}`}
                onPointerDown={handlePointerDown(k)}
                onPointerUp={handlePointerUp(k)}
                onPointerCancel={handlePointerUp(k)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    startNote(k)
                  }
                }}
              >
                {showLabel ? <span className="key-label">{label}</span> : null}
              </div>
            )
          })}
        </div>

          {blackNotes.map((b) => {
          // find position: number of white keys before this black key
          const note = b.note
          // find index in full notes array
          const fullIndex = notes.findIndex((n) => n === note)
          // count white keys before fullIndex
          const whitesBefore = notes.slice(0, fullIndex).filter((n) => !n.match(/[b#]/)).length
          const left = whitesBefore * keyWidth - keyWidth / 2 + keyWidth
          const label = toSharpName(note.replace(/\d+$/, ''))
          const showLabel = shownNotes.some((s) => noteToMidiGeneric(s) === noteToMidiGeneric(note))
          return (
            <div
              key={note}
              role="button"
              tabIndex={0}
              className={`black-key ${active[note] ? 'active' : ''}`}
              style={{ left: `${left}px` }}
              onPointerDown={handlePointerDown(note)}
              onPointerUp={handlePointerUp(note)}
              onPointerCancel={handlePointerUp(note)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  startNote(note)
                }
              }}
            >
              {showLabel ? <span className="key-label black-label">{label}</span> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
