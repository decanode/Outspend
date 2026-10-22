import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition'

/**
 * Thin wrapper over expo-speech-recognition for one-shot expense dictation.
 * Callbacks: onResult(transcript), onEnd(), onError(code).
 */
export class VoiceService {
  constructor({ onResult, onEnd, onError }) {
    this.onResult = onResult
    this.onEnd = onEnd
    this.onError = onError
    this.subs = []
  }

  async start() {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
    if (!perm.granted) {
      if (this.onError) this.onError('not-allowed')
      return false
    }
    this.clearListeners()
    this.subs.push(
      ExpoSpeechRecognitionModule.addListener('result', (event) => {
        const transcript = event.results && event.results[0] && event.results[0].transcript
        if (event.isFinal && transcript && this.onResult) this.onResult(transcript)
      }),
      ExpoSpeechRecognitionModule.addListener('end', () => {
        if (this.onEnd) this.onEnd()
      }),
      ExpoSpeechRecognitionModule.addListener('error', (event) => {
        if (this.onError) this.onError(event.error)
      })
    )
    ExpoSpeechRecognitionModule.start({ lang: 'en-IN', interimResults: false, maxAlternatives: 1 })
    return true
  }

  stop() {
    try { ExpoSpeechRecognitionModule.stop() } catch (e) { console.error(e) }
  }

  clearListeners() {
    this.subs.forEach(s => s.remove())
    this.subs = []
  }

  destroy() {
    this.clearListeners()
    try { ExpoSpeechRecognitionModule.abort() } catch { /* not running */ }
  }
}
