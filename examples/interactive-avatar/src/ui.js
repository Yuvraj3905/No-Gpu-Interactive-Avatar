export class UI {
  constructor() {
    this.statusDot = document.getElementById('status-dot')
    this.statusText = document.getElementById('status-text')
    this.chatHistory = document.getElementById('chat-history')
    this.micBtn = document.getElementById('mic-btn')
    this.transcript = document.getElementById('live-transcript')
  }

  setStatus(text, type) {
    this.statusText.textContent = text
    this.statusDot.className = 'status-dot ' + type
  }

  addChatBubble(role, text) {
    const bubble = document.createElement('div')
    bubble.className = 'chat-bubble ' + role
    bubble.textContent = text
    this.chatHistory.appendChild(bubble)
    this.chatHistory.scrollTop = this.chatHistory.scrollHeight
    return bubble
  }

  updateLastBubble(text) {
    const bubbles = this.chatHistory.querySelectorAll('.chat-bubble.assistant')
    const last = bubbles[bubbles.length - 1]
    if (last) last.textContent = text
    this.chatHistory.scrollTop = this.chatHistory.scrollHeight
  }

  setTranscript(text) {
    this.transcript.textContent = text || ''
  }

  setMicMuted(muted) {
    this.micBtn.classList.toggle('muted', muted)
    this.micBtn.textContent = muted ? 'Mic Off' : 'Mic On'
  }

  onMicClick(callback) {
    this.micBtn.addEventListener('click', callback)
  }
}
