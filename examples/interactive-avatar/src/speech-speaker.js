/**
 * Speech speaker using edge-tts server for high-quality neural voice.
 * Plays audio through Web Audio API and drives mouth animation manually
 * with reduced intensity (not using SDK's speak() which is too aggressive).
 */
export class SpeechSpeaker {
  constructor(avatarController) {
    this.ac = avatarController
    this.speaking = false
    this.audioContext = null
    this.analyser = null
    this.sourceNode = null
    this.animFrame = null
    this.ttsUrl = '/api/tts'
    this.ttsAvailable = null
    this.frequencyData = null
  }

  async speakSentence(text) {
    if (!text.trim()) return
    this.speaking = true

    try {
      if (this.ttsAvailable !== false) {
        const spoken = await this._speakWithTTS(text)
        if (spoken) return
      }
      await this._animateWithoutAudio(text)
    } finally {
      this.speaking = false
      this.ac.closeMouth()
      cancelAnimationFrame(this.animFrame)
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

      if (!this.audioContext) {
        this.audioContext = new AudioContext()
        this.analyser = this.audioContext.createAnalyser()
        this.analyser.fftSize = 256
        this.analyser.smoothingTimeConstant = 0.6
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount)
        this.analyser.connect(this.audioContext.destination)
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)

      return new Promise((resolve) => {
        // Stop previous source
        if (this.sourceNode) {
          try { this.sourceNode.stop(); this.sourceNode.disconnect() } catch {}
        }

        this.sourceNode = this.audioContext.createBufferSource()
        this.sourceNode.buffer = audioBuffer
        this.sourceNode.connect(this.analyser)

        this.sourceNode.onended = () => {
          cancelAnimationFrame(this.animFrame)
          this.ac.closeMouth()
          this.speaking = false
          resolve(true)
        }

        // Start audio
        this.sourceNode.start()

        // Start mouth animation driven by audio analysis
        const animate = () => {
          if (!this.speaking) return
          this.analyser.getByteFrequencyData(this.frequencyData)

          // Compute average energy in speech frequencies (200Hz - 4000Hz)
          // With 128 bins at 44100Hz, each bin ~172Hz
          // Bins 1-23 cover roughly 170Hz - 4000Hz
          let energy = 0
          for (let i = 1; i < 24; i++) {
            energy += this.frequencyData[i]
          }
          energy /= 23

          // Normalize to 0-1 range and apply gentle curve
          const normalized = Math.min(1.0, energy / 120)
          const mouthAmount = normalized * normalized * 0.45 // squared for softer movement, max 0.45

          if (mouthAmount > 0.02) {
            // Vary the viseme based on frequency balance
            const lowEnergy = (this.frequencyData[1] + this.frequencyData[2] + this.frequencyData[3]) / 3
            const midEnergy = (this.frequencyData[6] + this.frequencyData[7] + this.frequencyData[8]) / 3
            const highEnergy = (this.frequencyData[14] + this.frequencyData[15] + this.frequencyData[16]) / 3

            const total = lowEnergy + midEnergy + highEnergy + 1
            const lowRatio = lowEnergy / total
            const highRatio = highEnergy / total

            // Mix blendshapes based on frequency content
            this.ac.avatar.setBlendshapes({
              jawOpen: mouthAmount * 0.5,
              mouthClose: 0,
              viseme_aa: mouthAmount * lowRatio * 0.6,     // open vowels (low freq)
              viseme_E: mouthAmount * midEnergy / total * 0.4,  // mid vowels
              viseme_SS: mouthAmount * highRatio * 0.3,    // sibilants (high freq)
              mouthFunnel: mouthAmount * 0.1,
            })
          } else {
            this.ac.avatar.setBlendshapes({
              jawOpen: 0.01,
              mouthClose: 0.1,
            })
          }

          this.animFrame = requestAnimationFrame(animate)
        }

        this.animFrame = requestAnimationFrame(animate)
      })
    } catch (err) {
      console.warn('TTS error:', err)
      this.ttsAvailable = false
      return false
    }
  }

  async _animateWithoutAudio(text) {
    const words = text.split(/\s+/)
    for (const word of words) {
      if (!this.speaking) break
      const visemes = this._wordToVisemes(word)
      for (const viseme of visemes) {
        if (!this.speaking) break
        this.ac.setViseme(viseme, 0.5) // reduced intensity
        await new Promise(r => setTimeout(r, 100))
      }
      this.ac.setMouthOpen(0.02)
      await new Promise(r => setTimeout(r, 50))
    }
  }

  stop() {
    this.speaking = false
    if (this.sourceNode) {
      try { this.sourceNode.stop(); this.sourceNode.disconnect() } catch {}
      this.sourceNode = null
    }
    cancelAnimationFrame(this.animFrame)
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
