export class ChatStore {
  constructor() {
    this.messages = []
  }

  addUserMessage(text) {
    this.messages.push({ role: 'user', content: text })
  }

  addAssistantMessage(text) {
    this.messages.push({ role: 'assistant', content: text })
  }

  updateLastAssistant(text) {
    const last = this.messages[this.messages.length - 1]
    if (last && last.role === 'assistant') {
      last.content = text
    }
  }

  getOllamaMessages() {
    return [...this.messages]
  }
}
