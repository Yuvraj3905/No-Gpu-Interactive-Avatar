import { AvatarController } from './avatar-controller.js'
import { SpeechRecognizer } from './speech-recognizer.js'
import { OllamaClient } from './ollama-client.js'
import { SpeechSpeaker } from './speech-speaker.js'
import { detectEmotion } from './emotion-detector.js'
import { ChatStore } from './chat-store.js'
import { UI } from './ui.js'

async function main() {
  const ui = new UI()
  const chatStore = new ChatStore()
  const avatarController = new AvatarController(document.getElementById('avatar-container'))
  const recognizer = new SpeechRecognizer()
  const ollama = new OllamaClient()
  const speaker = new SpeechSpeaker(avatarController)

  let processing = false
  let micMuted = false

  // Load avatar
  ui.setStatus('Loading avatar...', 'loading')
  try {
    await avatarController.init()
    ui.setStatus('Ready - start talking!', 'idle')
  } catch (err) {
    ui.setStatus('Failed to load avatar: ' + err.message, 'error')
    return
  }

  // Welcome message
  setTimeout(async () => {
    avatarController.setEmotion('happy', 0.7)
    avatarController.playGesture('wave')
    // Stop wave gesture after 2.5 seconds so hand returns to rest
    setTimeout(() => avatarController.avatar.stopGesture({ transition: 500 }), 2500)
    ui.addChatBubble('assistant', "Hi! I'm Ava. Just start talking to me!")
    await speaker.speakSentence("Hi! I'm Ava. Just start talking to me!")
    avatarController.clearEmotion()
  }, 1000)

  // Mic toggle
  ui.onMicClick(() => {
    micMuted = !micMuted
    ui.setMicMuted(micMuted)
    if (micMuted) {
      recognizer.mute()
      ui.setStatus('Microphone muted', 'idle')
    } else {
      recognizer.unmute()
      ui.setStatus('Listening...', 'listening')
    }
  })

  // Speech recognition
  recognizer.onInterimResult((text) => {
    ui.setTranscript(text)
  })

  recognizer.onFinalResult(async (transcript) => {
    if (processing) return
    ui.setTranscript('')
    processing = true

    // If avatar is speaking, interrupt
    if (speaker.isSpeaking()) {
      speaker.stop()
      ollama.abort()
    }

    // Show user message
    chatStore.addUserMessage(transcript)
    ui.addChatBubble('user', transcript)

    // Set thinking
    ui.setStatus('Thinking...', 'thinking')
    avatarController.setEmotion('thinking', 0.7)

    // Mute mic while processing to prevent echo
    recognizer.mute()

    try {
      // Stream from Ollama
      let fullResponse = ''
      let currentSentence = ''
      const sentenceQueue = []

      chatStore.addAssistantMessage('')
      ui.addChatBubble('assistant', '')

      for await (const chunk of ollama.chat(chatStore.getOllamaMessages())) {
        fullResponse += chunk
        currentSentence += chunk
        chatStore.updateLastAssistant(fullResponse)
        ui.updateLastBubble(fullResponse)

        // Detect sentence boundaries
        if (/[.!?]\s*$/.test(currentSentence.trim()) && currentSentence.trim().length > 5) {
          sentenceQueue.push(currentSentence.trim())
          currentSentence = ''
        }
      }

      // Flush remaining
      if (currentSentence.trim()) {
        sentenceQueue.push(currentSentence.trim())
      }

      // Speak all sentences
      ui.setStatus('Speaking...', 'speaking')
      for (const sentence of sentenceQueue) {
        const emotion = detectEmotion(sentence)
        if (emotion !== 'neutral') {
          avatarController.setEmotion(emotion, 0.7)
        }
        await speaker.speakSentence(sentence)
      }

      // Greeting gesture
      const lower = transcript.toLowerCase()
      if (lower.includes('hello') || lower.includes('hi') || lower === 'hey') {
        avatarController.playGesture('nod')
      }

    } catch (err) {
      console.error('Error:', err)
      ui.addChatBubble('assistant', 'Sorry, I had trouble connecting. Is Ollama running?')
    } finally {
      // Always reset — even if something failed
      avatarController.clearEmotion()
      processing = false
      if (!micMuted) {
        recognizer.unmute()
        ui.setStatus('Listening...', 'listening')
      } else {
        ui.setStatus('Microphone muted', 'idle')
      }
    }
  })

  // Start always-listening
  if (recognizer.isSupported()) {
    recognizer.start()
    ui.setStatus('Listening...', 'listening')
  } else {
    ui.setStatus('Speech recognition not supported in this browser', 'error')
  }
}

main().catch(console.error)
