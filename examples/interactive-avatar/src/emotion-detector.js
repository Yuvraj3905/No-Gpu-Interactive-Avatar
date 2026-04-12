const EMOTION_KEYWORDS = {
  happy:     ['happy', 'great', 'wonderful', 'amazing', 'love', 'glad', 'fantastic', 'excellent', 'joy', 'excited', 'awesome', 'beautiful', 'perfect', 'thank'],
  sad:       ['sad', 'sorry', 'unfortunately', 'regret', 'miss', 'disappointing', 'terrible', 'awful', 'tragic'],
  angry:     ['angry', 'furious', 'annoyed', 'frustrat', 'outrage', 'unacceptable', 'hate'],
  surprised: ['wow', 'surprising', 'unexpected', 'incredible', 'unbelievable', 'shocked', 'amazing'],
  thinking:  ['hmm', 'let me think', 'consider', 'perhaps', 'maybe', 'interesting', 'well'],
  fearful:   ['afraid', 'scary', 'terrifying', 'fear', 'worried', 'anxious', 'dangerous'],
}

export function detectEmotion(text) {
  const lower = text.toLowerCase()
  let bestEmotion = 'neutral'
  let bestScore = 0

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    let score = 0
    for (const kw of keywords) {
      if (lower.includes(kw)) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestEmotion = emotion
    }
  }
  return bestEmotion
}
