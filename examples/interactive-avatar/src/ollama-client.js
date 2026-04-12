const SYSTEM_PROMPT = `You are Ava, a friendly and expressive avatar assistant. Keep your responses concise - 1 to 3 sentences maximum. Be conversational, warm, and natural. Show personality and emotion in your responses.`

export class OllamaClient {
  constructor(baseUrl = '/api/ollama') {
    this.baseUrl = baseUrl
    this.controller = null
  }

  async *chat(messages) {
    this.controller = new AbortController()

    const allMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ]

    let response
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.1:latest',
          messages: allMessages,
          stream: true,
        }),
        signal: this.controller.signal,
      })
    } catch (err) {
      if (err.name === 'AbortError') return
      throw new Error('Cannot reach Ollama. Is it running? Start with: OLLAMA_ORIGINS=* ollama serve')
    }

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      for (const line of text.split('\n')) {
        if (!line.trim()) continue
        try {
          const json = JSON.parse(line)
          if (json.message?.content) {
            yield json.message.content
          }
        } catch {}
      }
    }
  }

  abort() {
    this.controller?.abort()
    this.controller = null
  }
}
