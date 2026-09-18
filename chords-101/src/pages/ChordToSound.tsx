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

  // generate two octaves: C4..B5
  const notes: string[] = []
  for (let oct = 4; oct <= 5; oct++) {
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
    setActive((s) => ({ ...s, [note]: true }))
    if (hasSample) {
      try {
        samplerRef.current.triggerAttackRelease(note, duration)
      } catch {
        synthRef.current.triggerAttackRelease(note, duration)
      }
    } else {
      synthRef.current.triggerAttackRelease(note, duration)
    }
    // clear highlight after duration
    setTimeout(() => setActive((s) => ({ ...s, [note]: false })), durationMs + 20)
  }

  // legacy stopNote kept for sequences using explicit stop (not used now)
  function stopNote(note: string) {
    try {
      samplerRef.current.triggerRelease?.(note)
    } catch {}
    try {
      synthRef.current.triggerRelease?.(note)
    } catch {}
    setActive((s) => ({ ...s, [note]: false }))
  }

  // handlers for pointer interactions
  function handlePointerDown(note: string) {
    return (e: any) => {
      if (shownNotes.length) {
        setShownNotes([])
        if (hideTimeoutRef.current) {
          window.clearTimeout(hideTimeoutRef.current)
          hideTimeoutRef.current = null
        }
      }
      startNote(note)
    }
  }

  function handlePointerUp(note: string) {
    return (e: any) => {
      stopNote(note)
    }
  }

  const pianoWidth = whiteNotes.length * keyWidth
  // chord definitions (each line will render a description + one button)
  const chords = [
    {
      title: 'I — E (大三和弦): 三和弦: E G# B',
      triad: ['E4', 'G#4', 'B4'],
      seventh: ['E4', 'G#4', 'B4', 'D#5'],
    },
    {
      title: 'ii — F#m (小三和弦): 三和弦: F# A C#',
      triad: ['F#4', 'A4', 'C#5'],
      seventh: ['F#4', 'A4', 'C#5', 'E5'],
    },
    {
      title: 'iii — G#m (小三和弦): 三和弦: G# B D#',
      triad: ['G#4', 'B4', 'D#5'],
      seventh: ['G#4', 'B4', 'D#5', 'F#5'],
    },
    {
      title: 'IV — A (大三和弦): 三和弦: A C# E',
      triad: ['A4', 'C#5', 'E5'],
      seventh: ['A4', 'C#5', 'E5', 'G#5'],
    },
    {
      title: 'V — B (大三和弦 / 属和弦): 三和弦: B D# F#',
      triad: ['B4', 'D#5', 'F#5'],
      seventh: ['B4', 'D#5', 'F#5', 'A5'],
    },
    {
      title: 'vi — C#m (小三和弦): 三和弦: C# E G#',
      triad: ['C#4', 'E4', 'G#4'],
      seventh: ['C#4', 'E4', 'G#4', 'B4'],
    },
    {
      title: 'vii° — D#° (减三和弦): 三和弦: D# F# A',
      triad: ['D#4', 'F#4', 'A4'],
      seventh: ['D#4', 'F#4', 'A4', 'C#5'],
    },
    // Sus examples
    {
      title: 'Esus2 = E F# B (替代三度)',
      triad: ['E4', 'F#4', 'B4'],
      seventh: null,
    },
    {
      title: 'Esus4 = E A B (替代三度)',
      triad: ['E4', 'A4', 'B4'],
      seventh: null,
    },
  ]

  function playChordSequence(notesArr: string[], noteDuration = 360, gap = 120) {
    if (!notesArr || notesArr.length === 0) return
    setShownNotes(notesArr)
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    let t = 0
    for (const n of notesArr) {
      window.setTimeout(() => startNote(n, noteDuration), t)
      t += noteDuration + gap
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 12 }}>
        {chords.map((c, idx) => (
          <div key={`chord-${idx}`} style={{ marginBottom: 8 }}>
            <span style={{ marginRight: 10 }}>{c.title}</span>
            <button
              type="button"
              onClick={() => playChordSequence(c.seventh ?? c.triad)}
            >
              Play
            </button>
          </div>
        ))}
        <span style={{ marginLeft: 12 }}>{samplesLoaded ? 'Samples ready' : 'Loading samples...'}</span>
      </div>
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
                    if (shownNotes.length) {
                      setShownNotes([])
                      if (hideTimeoutRef.current) {
                        window.clearTimeout(hideTimeoutRef.current)
                        hideTimeoutRef.current = null
                      }
                    }
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
                  if (shownNotes.length) {
                    setShownNotes([])
                    if (hideTimeoutRef.current) {
                      window.clearTimeout(hideTimeoutRef.current)
                      hideTimeoutRef.current = null
                    }
                  }
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
