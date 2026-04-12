/**
 * Speech speaker using edge-tts server for high-quality neural voice.
 * Fetches audio from TTS server, decodes to AudioBuffer, and uses
 * the SDK's speak() method for proper frequency-based lip-sync.
 * Falls back to mouth animation without audio if TTS server is unavailable.
 */
export class SpeechSpeaker {
  constructor(avatarController) {
    this.ac = avatarController
    this.speaking = false
    this.audioContext = null
    this.ttsUrl = '/api/tts'
    this.ttsAvailable = null // null = unknown, true/false after first check
  }

  async speakSentence(text) {
    if (!text.trim()) return
    this.speaking = true

    try {
      // Try TTS server first
      if (this.ttsAvailable !== false) {
        const spoken = await this._speakWithTTS(text)
        if (spoken) {
          this.speaking = false
          return
        }
      }

      // Fallback: animate mouth without audio (visual-only lip sync)
      await this._animateWithoutAudio(text)
    } finally {
      this.speaking = false
      this.ac.closeMouth()
    }
  }

  async _speakWithTTS(text) {
    try {
      const response = await fetch(this.ttsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        this.ttsAvailable = false
        return false
      }

      this.ttsAvailable = true

      // Decode audio
      if (!this.audioContext) {
        this.audioContext = new AudioContext()
      }

      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)

      // Use the SDK's speak() for real frequency-based lip-sync
      await this.ac.avatar.speak(audioBuffer)
      return true
    } catch {
      this.ttsAvailable = false
      return false
    }
  }

  async _animateWithoutAudio(text) {
    // Visual-only fallback: animate mouth based on text length
    const words = text.split(/\s+/)
    const msPerWord = 200

    for (const word of words) {
      if (!this.speaking) break
      const visemes = this._wordToVisemes(word)
      for (const viseme of visemes) {
        if (!this.speaking) break
        this.ac.setViseme(viseme, 0.7)
        await new Promise(r => setTimeout(r, 100))
      }
      // Brief pause between words
      this.ac.setMouthOpen(0.05)
      await new Promise(r => setTimeout(r, 50))
    }
  }

  stop() {
    this.speaking = false
    this.ac.closeMouth()
  }

  isSpeaking() { return this.speaking }

  _wordToVisemes(word) {
    const visemes = []
    for (const char of word.toLowerCase()) {
      if ('ao'.includes(char)) visemes.push('open')
      else if ('ei'.includes(char)) visemes.push('wide')
      else if (char === 'u') visemes.push('round')
      else if ('mbp'.includes(char)) visemes.push('closed')
      else if ('fv'.includes(char)) visemes.push('teeth')
      else if ('sz'.includes(char)) visemes.push('narrow')
    }
    if (visemes.length === 0) visemes.push('default')
    return visemes.slice(0, 3)
  }
}
