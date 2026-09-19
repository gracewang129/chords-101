import { describe, expect, it } from 'vitest'
import { appendQuizNote, isChordGuessComplete, resetQuizHistory } from './quizLogic'

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

  it('only accepts the most recent chord-sized window, not an older valid subset', () => {
    const targetNotes = ['C4', 'E4', 'G4']
    const recentNotes = ['C4', 'D4', 'E4', 'F4', 'G4']

    expect(isChordGuessComplete(targetNotes, recentNotes)).toBe(false)
  })

  it('rejects a chord when a wrong note appears in the final chord-sized window', () => {
    const targetNotes = ['C4', 'E4', 'G4']

    let history: string[] = []
    history = appendQuizNote(targetNotes, history, 'C4').history
    history = appendQuizNote(targetNotes, history, 'D4').history
    history = appendQuizNote(targetNotes, history, 'E4').history
    history = appendQuizNote(targetNotes, history, 'F4').history
    const finalStep = appendQuizNote(targetNotes, history, 'G4')

    expect(finalStep.isComplete).toBe(false)
  })

  it('keeps the same chord target after a reset so it can be completed again', () => {
    const targetNotes = ['E4', 'G#4', 'B4', 'D5']
    const attemptedFirst = appendQuizNote(targetNotes, [], 'E4')
    const attemptedSecond = appendQuizNote(targetNotes, attemptedFirst.history, 'G#4')
    const attemptedThird = appendQuizNote(targetNotes, attemptedSecond.history, 'B4')
    const completeFirst = appendQuizNote(targetNotes, attemptedThird.history, 'D5')

    expect(completeFirst.isComplete).toBe(true)

    const reset = resetQuizHistory(targetNotes, completeFirst.history)
    let secondHistory = reset.recentNotes
    secondHistory = appendQuizNote(reset.targetNotes, secondHistory, 'G#4').history
    secondHistory = appendQuizNote(reset.targetNotes, secondHistory, 'E4').history
    secondHistory = appendQuizNote(reset.targetNotes, secondHistory, 'B4').history
    const completeSecond = appendQuizNote(reset.targetNotes, secondHistory, 'D5')

    expect(completeSecond.isComplete).toBe(true)
  })
})
