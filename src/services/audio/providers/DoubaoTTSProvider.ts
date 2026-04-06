/**
 * DoubaoTTSProvider — Native SpeechEngine bridge for 豆包/火山 TTS
 *
 * iOS uses the existing HeaderWebSocket bridge.
 * Android is wired to use DoubaoSpeechModule as the native entry point.
 */

import { type EmitterSubscription } from 'react-native';
import type { TTSProvider, TTSEventHandlers } from '../TTSService';
import type { TTSProviderConfig } from '@/types/config';
import { getLogger } from '@/utils/logger';
import { doubaoNativeBridge } from '../native/doubaoNative';

const log = getLogger('DoubaoTTS');

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class DoubaoTTSProvider implements TTSProvider {
  private config: TTSProviderConfig | null = null;
  private statusSub: EmitterSubscription | null = null;
  private errorSub: EmitterSubscription | null = null;
  private pendingResolve: (() => void) | null = null;
  private pendingReject: ((error: Error) => void) | null = null;
  private pendingHandlers: TTSEventHandlers | null = null;
  private hasStartedPlayback = false;
  private nativeBridge = doubaoNativeBridge.getBridge();
  private nativeEmitter = doubaoNativeBridge.getEmitter();

  async initialize(config: TTSProviderConfig): Promise<void> {
    this.nativeBridge = doubaoNativeBridge.getBridge();
    this.nativeEmitter = doubaoNativeBridge.getEmitter();

    if (!this.nativeBridge?.initializeDoubaoTTS || !this.nativeBridge?.speakDoubaoTTS) {
      throw new Error('Doubao native TTS bridge is not available on this platform');
    }

    const nextConfig: TTSProviderConfig = { ...config };
    nextConfig.address ||= 'wss://openspeech.bytedance.com';
    nextConfig.uri ||= '/api/v3/tts/bidirection';
    nextConfig.resourceId ||= 'seed-tts-2.0';
    nextConfig.voiceId ||= 'TTS-SeedTTS2.02000000687609518146';
    nextConfig.voiceType ||= 'zh_female_vv_uranus_bigtts';
    nextConfig.language ||= 'zh-CN';
    nextConfig.speed ??= 1.0;

    if (!nextConfig.appId || !nextConfig.accessToken) {
      throw new Error('Doubao TTS credentials are missing. Please configure them in Settings.');
    }

    this.ensureListeners();

    try {
      await this.nativeBridge.initializeDoubaoTTS({
        appId: nextConfig.appId,
        accessToken: nextConfig.accessToken,
        address: nextConfig.address,
        uri: nextConfig.uri,
        resourceId: nextConfig.resourceId,
        voiceId: nextConfig.voiceId,
        voiceType: nextConfig.voiceType,
        language: nextConfig.language,
        speed: nextConfig.speed ?? 1.0,
        options: nextConfig.options,
      });
    } catch (error) {
      this.config = null;
      throw error;
    }

    this.config = nextConfig;

    log.info('DoubaoTTS initialized:', {
      resourceId: nextConfig.resourceId,
      instanceName: nextConfig.voiceId,
      voiceId: nextConfig.voiceId,
      speaker: nextConfig.voiceType,
      language: nextConfig.language,
      speed: nextConfig.speed ?? 1.0,
    });
  }

  async speak(text: string, handlers?: TTSEventHandlers): Promise<void> {
    if (!text.trim()) return;
    if (!this.config) {
      throw new Error('Doubao TTS not initialized');
    }

    this.ensureListeners();
    await this.stop();

    this.pendingHandlers = handlers || null;
    this.hasStartedPlayback = false;

    return new Promise<void>(async (resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;

      try {
        log.info('DoubaoTTS speaking:', text.slice(0, 60));
        await this.nativeBridge?.speakDoubaoTTS(text);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(getErrorMessage(error));
        this.rejectPending(err);
      }
    });
  }

  async stop(): Promise<void> {
    try {
      await this.nativeBridge?.stopDoubaoTTS?.();
    } catch (error) {
      log.warn('DoubaoTTS stop failed:', getErrorMessage(error));
    }
    this.clearPending();
  }

  async destroy(): Promise<void> {
    await this.stop();
    try {
      await this.nativeBridge?.destroyDoubaoTTS?.();
    } catch (error) {
      log.warn('DoubaoTTS destroy failed:', getErrorMessage(error));
    }
    this.removeListeners();
    this.config = null;
  }

  private ensureListeners(): void {
    if (!this.nativeEmitter) {
      throw new Error('Doubao native TTS event emitter is not available');
    }
    if (!this.statusSub) {
      this.statusSub = this.nativeEmitter.addListener('onTTSStatus', (event: { status?: string }) => {
        const status = event?.status || 'unknown';
        log.info('DoubaoTTS native status:', status);

        if (status === 'playing' && !this.hasStartedPlayback) {
          this.hasStartedPlayback = true;
          this.pendingHandlers?.onStart?.();
        }

        if (status === 'finished' || status === 'stopped') {
          this.pendingHandlers?.onDone?.();
          this.resolvePending();
        }
      });
    }

    if (!this.errorSub) {
      this.errorSub = this.nativeEmitter.addListener('onTTSError', (event: { message?: string; code?: number }) => {
        const err = new Error(event?.message || 'Native Doubao TTS failed');
        log.warn('DoubaoTTS native error:', event?.code, err.message);
        this.rejectPending(err);
      });
    }
  }

  private removeListeners(): void {
    this.statusSub?.remove();
    this.statusSub = null;
    this.errorSub?.remove();
    this.errorSub = null;
  }

  private resolvePending(): void {
    const resolve = this.pendingResolve;
    this.clearPending();
    resolve?.();
  }

  private rejectPending(error: Error): void {
    const reject = this.pendingReject;
    this.pendingHandlers?.onError?.(error);
    this.clearPending();
    reject?.(error);
  }

  private clearPending(): void {
    this.pendingResolve = null;
    this.pendingReject = null;
    this.pendingHandlers = null;
    this.hasStartedPlayback = false;
  }
}
