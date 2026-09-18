import { describe, expect, it } from 'vitest'
import { appendQuizNote, isChordGuessComplete } from './quizLogic'

describe('quizLogic', () => {
  it('marks the answer as complete when the most recent chord notes match the chord exactly', () => {
    const targetNotes = ['E4', 'G#4', 'B4', 'D5']
    const recentNotes = ['E4', 'B4', 'D5', 'G#4']

    expect(isChordGuessComplete(targetNotes, recentNotes)).toBe(true)
  })

  it('treats enharmonic flat names as the same pitch when checking a chord', () => {
    const targetNotes = ['E4', 'G4', 'A#4', 'D5']
    const recentNotes = ['E4', 'Bb4', 'D5', 'G4']

    expect(isChordGuessComplete(targetNotes, recentNotes)).toBe(true)
  })

  it('ignores wrong notes and still succeeds after the player eventually finds all chord tones', () => {
    const targetNotes = ['E4', 'G#4', 'B4', 'D5']

    let history: string[] = []
    history = appendQuizNote(targetNotes, history, 'F4').history
    history = appendQuizNote(targetNotes, history, 'E4').history
    history = appendQuizNote(targetNotes, history, 'G#4').history
    history = appendQuizNote(targetNotes, history, 'B4').history
    const finalStep = appendQuizNote(targetNotes, history, 'D5')

    expect(finalStep.isComplete).toBe(true)
  })

  it('does not mark the answer as complete when a note is outside the chord', () => {
    const targetNotes = ['E4', 'G#4', 'B4', 'D5']
    const recentNotes = ['E4', 'B4', 'D5', 'F4']

    expect(isChordGuessComplete(targetNotes, recentNotes)).toBe(false)
  })
})
