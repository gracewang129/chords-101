function normalizeNoteName(note: string): string {
  const match = note.match(/^([A-G](?:#|b)?)(-?\d+)$/)
  if (!match) return note

  const [, name, octave] = match
  const flatToSharp: Record<string, string> = {
    Db: 'C#',
    Eb: 'D#',
    Gb: 'F#',
    Ab: 'G#',
    Bb: 'A#',
  }

  return `${flatToSharp[name] ?? name}${octave}`
}

export function isChordGuessComplete(targetNotes: string[], recentNotes: string[]): boolean {
  if (!targetNotes.length || recentNotes.length !== targetNotes.length) {
    return false
  }

  const normalizedTarget = targetNotes.map(normalizeNoteName)
  const normalizedRecent = recentNotes.map(normalizeNoteName)
  const targetSet = new Set(normalizedTarget)
  const recentSet = new Set(normalizedRecent)

  return normalizedRecent.every((note) => targetSet.has(note)) && normalizedTarget.every((note) => recentSet.has(note))
}

export function appendQuizNote(targetNotes: string[], history: string[], note: string) {
  const normalizedTarget = targetNotes.map(normalizeNoteName)
  const normalizedNote = normalizeNoteName(note)

  if (!normalizedTarget.includes(normalizedNote)) {
    return {
      history,
      isComplete: false,
    }
  }

  const nextHistory = [...new Set([...history, normalizedNote].map(normalizeNoteName))]
  const isComplete = normalizedTarget.every((target) => nextHistory.includes(target))

  return {
    history: nextHistory,
    isComplete,
  }
}
