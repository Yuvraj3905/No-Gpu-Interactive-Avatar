export class AudioAnalyzer {
  private audioContext: AudioContext
  private analyser: AnalyserNode
  private sourceNode: AudioBufferSourceNode | null = null

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
    this.analyser = audioContext.createAnalyser()
    this.analyser.fftSize = 256
    this.analyser.smoothingTimeConstant = 0.5
  }

  getAnalyser(): AnalyserNode {
    return this.analyser
  }

  getAudioContext(): AudioContext {
    return this.audioContext
  }

  playBuffer(buffer: AudioBuffer, onEnded?: () => void): AudioBufferSourceNode {
    this.stop()
    this.sourceNode = this.audioContext.createBufferSource()
    this.sourceNode.buffer = buffer
    this.sourceNode.connect(this.analyser)
    this.analyser.connect(this.audioContext.destination)
    if (onEnded) {
      this.sourceNode.onended = onEnded
    }
    this.sourceNode.start()
    return this.sourceNode
  }

  stop(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop()
        this.sourceNode.disconnect()
      } catch {
        // Already stopped
      }
      this.sourceNode = null
    }
  }

  dispose(): void {
    this.stop()
    this.analyser.disconnect()
  }
}
