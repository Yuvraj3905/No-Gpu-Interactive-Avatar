export class SpeechSpeaker {
  constructor(avatarController) {
    this.ac = avatarController
    this.speaking = false
    this.currentUtterance = null
    this.animFrame = null
    this.selectedVoice = null
    this._selectVoice()
    speechSynthesis.onvoiceschanged = () => this._selectVoice()
  }

  _selectVoice() {
    const voices = speechSynthesis.getVoices()
    this.selectedVoice =
      voices.find(v => v.name.includes('Female') && v.lang.startsWith('en')) ||
      voices.find(v => v.name.includes('Samantha')) ||
      voices.find(v => v.name.includes('Google UK English Female')) ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0] || null
  }

  async speakSentence(text) {
    if (!text.trim()) return
    this.speaking = true

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.0
      utterance.pitch = 1.1
      if (this.selectedVoice) utterance.voice = this.selectedVoice
      this.currentUtterance = utterance

      let boundarySupported = false
      let currentVisemes = []
      let visemeStart = 0
      const VISEME_MS = 120

      const animate = () => {
        if (!this.speaking) return
        if (boundarySupported && currentVisemes.length > 0) {
          const elapsed = performance.now() - visemeStart
          const idx = Math.min(Math.floor(elapsed / VISEME_MS), currentVisemes.length - 1)
          this.ac.setViseme(currentVisemes[idx], 0.7)
        } else if (!boundarySupported && this.speaking) {
          // Fallback: oscillate mouth
          const t = performance.now() / 1000
          const amount = (Math.sin(t * 12) + 1) * 0.25
          this.ac.setMouthOpen(amount)
        }
        this.animFrame = requestAnimationFrame(animate)
      }

      utterance.onstart = () => {
        this.animFrame = requestAnimationFrame(animate)
      }

      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          boundarySupported = true
          const word = text.substring(event.charIndex, event.charIndex + (event.charLength || 4))
          currentVisemes = this._wordToVisemes(word)
          visemeStart = performance.now()
        }
      }

      utterance.onend = () => {
        this.speaking = false
        cancelAnimationFrame(this.animFrame)
        this.ac.closeMouth()
        this.currentUtterance = null
        resolve()
      }

      utterance.onerror = () => {
        this.speaking = false
        cancelAnimationFrame(this.animFrame)
        this.ac.closeMouth()
        this.currentUtterance = null
        resolve()
      }

      speechSynthesis.speak(utterance)
    })
  }

  stop() {
    this.speaking = false
    speechSynthesis.cancel()
    cancelAnimationFrame(this.animFrame)
    this.ac.closeMouth()
    this.currentUtterance = null
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
      else if ('aeiou'.includes(char)) visemes.push('open')
    }
    if (visemes.length === 0) visemes.push('default')
    return visemes.slice(0, 4) // max 4 visemes per word
  }
}
