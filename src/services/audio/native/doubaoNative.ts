import { NativeEventEmitter, NativeModules } from 'react-native';

type DoubaoTTSBridge = {
  initializeDoubaoTTS(config: Record<string, unknown>): Promise<boolean>;
  speakDoubaoTTS(text: string): Promise<boolean>;
  stopDoubaoTTS(): Promise<boolean>;
  destroyDoubaoTTS(): Promise<boolean>;
};

function getNativeBridge(): DoubaoTTSBridge | null {
  return (NativeModules.DoubaoSpeechModule ??
    NativeModules.HeaderWebSocket ??
    null) as DoubaoTTSBridge | null;
}

function getNativeEmitter(): NativeEventEmitter | null {
  const bridge = getNativeBridge();
  return bridge ? new NativeEventEmitter(bridge as never) : null;
}

export const doubaoNativeBridge = {
  getBridge: getNativeBridge,
  getEmitter: getNativeEmitter,
};
