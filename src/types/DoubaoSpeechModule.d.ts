/**
 * Type declarations for Android DoubaoSpeechModule native bridge.
 * Event names intentionally match the iOS bridge so the JS provider can be shared.
 */

declare module 'NativeModules' {
  interface NativeModulesStatic {
    DoubaoSpeechModule?: {
      initializeDoubaoTTS(config: Record<string, unknown>): Promise<boolean>;
      speakDoubaoTTS(text: string): Promise<boolean>;
      stopDoubaoTTS(): Promise<boolean>;
      destroyDoubaoTTS(): Promise<boolean>;
    };
  }
}
