/**
 * EdgeTTSProvider — Microsoft Edge TTS (free, no API key required)
 *
 * Uses Microsoft's Edge Text-to-Speech service via REST API.
 * Supports 300+ voices across 40+ languages.
 */

import { AudioContext } from 'react-native-audio-api';
import type { TTSProvider, TTSEventHandlers } from '../TTSService';
import type { TTSProviderConfig } from '@/types/config';
import { getLogger } from '@/utils/logger';
import RNFS from 'react-native-fs';

const log = getLogger('EdgeTTS');

// ─── Constants ──────────────────────────────────────────────────────

const SYNTHESIS_URL = 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/connections/v1';
const DEFAULT_VOICE_ZH = 'zh-CN-XiaoxiaoNeural';
const DEFAULT_VOICE_EN = 'en-US-JennyNeural';

const VOICE_MAP: Record<string, string> = {
  'zh-CN': DEFAULT_VOICE_ZH,
  'zh-TW': 'zh-TW-HsiaoChenNeural',
  'en-US': DEFAULT_VOICE_EN,
  'en-GB': 'en-GB-SoniaNeural',
  'ja-JP': 'ja-JP-NanamiNeural',
  'ko-KR': 'ko-KR-SunHiNeural',
};

// ─── Provider ──────────────────────────────────────────────────────

export class EdgeTTSProvider implements TTSProvider {
  private config: TTSProviderConfig | null = null;
  private audioContext: AudioContext | null = null;
  private currentPlayback: { status: 'idle' | 'playing' | 'loading' } = { status: 'idle' };

  async initialize(config: TTSProviderConfig): Promise<void> {
    this.config = config;
    this.audioContext = new AudioContext();
    log.info('EdgeTTS initialized:', {
      voice: config.voiceId || VOICE_MAP[config.language] || DEFAULT_VOICE_ZH,
      language: config.language,
      speed: config.speed ?? 1.0,
    });
  }

  async speak(text: string, handlers?: TTSEventHandlers): Promise<void> {
    if (!text.trim()) return;

    const voice = this.config?.voiceId || VOICE_MAP[this.config?.language || ''] || DEFAULT_VOICE_ZH;
    const rate = (this.config?.speed ?? 1.0).toString();
    const ssml = this.buildSSML(text, voice, rate);

    log.info('EdgeTTS speaking:', text.slice(0, 60), '[voice:', voice, ']');
    handlers?.onStart?.();

    try {
      const audioData = await this.synthesize(ssml);
      if (!audioData) {
        throw new Error('No audio data received from Edge TTS');
      }

      await this.playAudio(audioData);
      handlers?.onDone?.();

    } catch (error) {
      log.error('EdgeTTS speak failed:', error);
      handlers?.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async stop(): Promise<void> {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.currentPlayback = { status: 'idle' };
    log.info('EdgeTTS stopped');
  }

  async destroy(): Promise<void> {
    await this.stop();
  }

  private buildSSML(text: string, voice: string, rate: string): string {
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.microsoft.com/mstts" xml:lang="${this.config?.language || 'zh-CN'}">
  <voice name="${voice}">
    <prosody rate="${rate}">${this.escapeXml(text)}</prosody>
  </voice>
</speak>`;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private async synthesize(ssml: string): Promise<ArrayBuffer | null> {
    try {
      const response = await fetch(SYNTHESIS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'MobileClaw/1.0',
        },
        body: ssml,
      });

      if (!response.ok) {
        throw new Error(`Edge TTS API error: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      log.debug(`Synthesized ${arrayBuffer.byteLength} bytes of audio`);
      return arrayBuffer;

    } catch (error) {
      log.error('Edge TTS synthesis failed:', error);
      return null;
    }
  }

  private async playAudio(audioData: ArrayBuffer): Promise<void> {
    await this.stop();

    const tempPath = `${RNFS.CachesDirectoryPath}/tts_edge.mp3`;
    const uint8 = new Uint8Array(audioData);
    await RNFS.writeFile(tempPath, uint8.toBase64(), 'base64');

    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      const response = await fetch(`file://${tempPath}`);
      const buffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(buffer);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      this.currentPlayback = { status: 'playing' };

      return new Promise((resolve, reject) => {
        source.onended = () => {
          this.currentPlayback = { status: 'idle' };
          resolve(undefined);
        };

        source.start(0);

        setTimeout(() => {
          if (this.currentPlayback.status === 'playing') {
            source.stop();
            this.currentPlayback = { status: 'idle' };
            resolve(undefined);
          }
        }, 30_000);
      });

    } catch (error) {
      log.error('Audio playback failed:', error);
      this.currentPlayback = { status: 'idle' };
      throw error;
    }
  }
}

// Helper: Uint8Array to base64
function uint8ToBase64(uint8: Uint8Array): string {
  const binary = String.fromCharCode(...uint8);
  return btoa(binary);
}
