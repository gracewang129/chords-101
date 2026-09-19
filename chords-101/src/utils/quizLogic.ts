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
  if (!targetNotes.length) {
    return false
  }

  const normalizedTarget = targetNotes.map(normalizeNoteName)
  const normalizedRecent = recentNotes.map(normalizeNoteName)
  const window = normalizedRecent.slice(-normalizedTarget.length)

  if (window.length < normalizedTarget.length) {
    return false
  }

  const targetSet = new Set(normalizedTarget)
  return window.every((note) => targetSet.has(note)) && normalizedTarget.every((note) => window.includes(note))
}

export function resetQuizHistory(targetNotes: string[], history: string[] = []) {
  return {
    targetNotes: targetNotes.map(normalizeNoteName),
    recentNotes: [] as string[],
    previousHistory: history.map(normalizeNoteName),
  }
}

export function appendQuizNote(targetNotes: string[], history: string[], note: string) {
  const normalizedTarget = targetNotes.map(normalizeNoteName)
  const normalizedNote = normalizeNoteName(note)

  const nextHistory = [...history.map(normalizeNoteName), normalizedNote]
  const window = nextHistory.slice(-normalizedTarget.length)
  const isComplete = isChordGuessComplete(normalizedTarget, window)

  return {
    history: window,
    isComplete,
  }
}
