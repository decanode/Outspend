import * as SpeechRecognition from 'expo-speech-recognition';

export class VoiceService {
  constructor(onResultCallback) {
    this.onResultCallback = onResultCallback;
    this.listener = null;
  }

  async startListening() {
    try {
      const { status } = await SpeechRecognition.requestPermissionsAsync();
      if (status !== 'granted') {
        console.error('Speech recognition permission not granted');
        return;
      }

      this.listener = SpeechRecognition.addListener('onSpeechResults', (event) => {
        if (event.value && event.value.length > 0) {
          this.onResultCallback(event.value[0]);
        }
      });

      await SpeechRecognition.startSpeechRecognitionAsync({
        language: 'en-US',
      });
    } catch (e) {
      console.error(e);
    }
  }

  async stopListening() {
    try {
      await SpeechRecognition.stopSpeechRecognitionAsync();
    } catch (e) {
      console.error(e);
    }
  }

  destroy() {
    if (this.listener) {
      this.listener.remove();
    }
  }
}

