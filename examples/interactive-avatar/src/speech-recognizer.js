export class SpeechRecognizer {
  constructor() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      this.supported = false
      return
    }
    this.supported = true
    this.recognition = new SpeechRecognition()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = 'en-US'
    this.muted = false
    this.running = false
    this._onFinalResult = null
    this._onInterimResult = null

    this.recognition.onresult = (event) => {
      if (this.muted) return
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          const transcript = result[0].transcript.trim()
          if (transcript && this._onFinalResult) {
            this._onFinalResult(transcript)
          }
        } else {
          if (this._onInterimResult) {
            this._onInterimResult(result[0].transcript)
          }
        }
      }
    }

    this.recognition.onend = () => {
      // Auto-restart if still supposed to be running
      if (this.running && !this.muted) {
        try { this.recognition.start() } catch {}
      }
    }

    this.recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        console.error('Microphone permission denied')
      }
      // Restart on recoverable errors
      if (event.error === 'no-speech' || event.error === 'aborted') {
        if (this.running) {
          try { this.recognition.start() } catch {}
        }
      }
    }
  }

  onFinalResult(callback) { this._onFinalResult = callback }
  onInterimResult(callback) { this._onInterimResult = callback }

  start() {
    if (!this.supported) return
    this.running = true
    this.muted = false
    try { this.recognition.start() } catch {}
  }

  stop() {
    this.running = false
    try { this.recognition.stop() } catch {}
  }

  mute() { this.muted = true }
  unmute() { this.muted = false }
  isSupported() { return this.supported }
}
