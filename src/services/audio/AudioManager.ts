/**
 * AudioManager — Audio session configuration + recording lifecycle
 *
 * Uses react-native-audio-api for audio context management.
 * Recording is stubbed — see AudioCaptureBridge for actual recording implementation.
 */

import { AudioContext } from 'react-native-audio-api';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { getLogger } from '@/utils/logger';

const log = getLogger('AudioManager');

let audioContext: AudioContext | null = null;

export interface AudioSessionConfig {
  allowsRecordingIOS?: boolean;
  playsInSilentModeIOS?: boolean;
  shouldDuckAndroid?: boolean;
}

const DEFAULT_SESSION_CONFIG: AudioSessionConfig = {
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true,
  shouldDuckAndroid: true,
};

export class AudioManager {
  private configured = false;
  private recording = false;

  // Volume level callback (for waveform visualization)
  private volumeListeners: Set<(level: number) => void> = new Set();

  /**
   * Configure audio context.
   */
  async configureSession(config?: Partial<AudioSessionConfig>): Promise<void> {
    log.info('Configuring audio session...', Platform.OS);

    try {
      if (!audioContext) {
        audioContext = new AudioContext();
      }
      this.configured = true;
      log.info('Audio session configured successfully');
    } catch (err) {
      log.error('Failed to configure audio session:', err);
      throw err;
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Request microphone permission.
   */
  async ensureMicrophonePermission(): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: '麦克风权限',
            message: 'MobileClaw 需要访问麦克风进行语音识别',
            buttonNeutral: '稍后询问',
            buttonNegative: '取消',
            buttonPositive: '允许',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('需要麦克风权限', '请在设置中允许 MobileClaw 访问麦克风');
          throw new Error('Microphone permission denied');
        }
      } catch (err) {
        throw err;
      }
    }
    // iOS: handled by react-native-audio-api
  }

  /**
   * Start audio recording (stubbed - actual implementation in AudioCaptureBridge).
   */
  async startRecording(): Promise<unknown> {
    log.info('startRecording called (stubbed)');
    this.recording = true;
    return null;
  }

  /**
   * Stop recording.
   */
  async stopRecording(): Promise<string | null> {
    log.info('stopRecording called (stubbed)');
    this.recording = false;
    return null;
  }

  getIsRecording(): boolean {
    return this.recording;
  }

  /**
   * Register a listener for volume level updates (for WaveformView).
   */
  onVolumeUpdate(listener: (level: number) => void): () => void {
    this.volumeListeners.add(listener);
    return () => this.volumeListeners.delete(listener);
  }

  emitVolumeLevel(level: number): void {
    const normalized = Math.max(0, Math.min(1, level));
    this.volumeListeners.forEach((fn) => fn(normalized));
  }

  destroy(): void {
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    this.configured = false;
  }
}

export const audioManager = new AudioManager();
