/**
 * SecureStorage — Platform secure storage abstraction
 *
 * Wraps iOS Keychain / Android EncryptedSharedPreferences for sensitive credentials.
 *
 * Uses react-native-keychain which provides:
 *   iOS:     Keychain Services
 *   Android: EncryptedSharedPreferences (AES256-GCM)
 *
 * All data is encrypted at rest and requires device unlock to access.
 */

import * as Keychain from 'react-native-keychain';

/** Service name used as the Keychain service identifier */
const SERVICE = 'mobileclaw';

// In-memory cache for quick access
let cache: Record<string, string> = {};
let cacheLoaded = false;

/**
 * Load all stored values into memory cache.
 * Uses a single keychain entry to store all values as JSON.
 */
async function loadCache(): Promise<void> {
  if (cacheLoaded) return;
  try {
    const result = await Keychain.getGenericPassword({ service: SERVICE });
    if (result && result.password) {
      cache = JSON.parse(result.password);
    }
    cacheLoaded = true;
  } catch {
    cache = {};
    cacheLoaded = true;
  }
}

/**
 * Persist current cache to keychain.
 */
async function saveCache(): Promise<void> {
  await Keychain.setGenericPassword('mobileclaw', JSON.stringify(cache), {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
  });
}

export class SecureStorage {
  /**
   * Store a value securely.
   */
  static async setItem(key: string, value: string): Promise<void> {
    await loadCache();
    cache[key] = value;
    await saveCache();
  }

  /**
   * Retrieve a stored value.
   */
  static async getItem(key: string): Promise<string | null> {
    await loadCache();
    return cache[key] ?? null;
  }

  /**
   * Remove a stored value.
   */
  static async removeItem(key: string): Promise<void> {
    await loadCache();
    delete cache[key];
    await saveCache();
  }

  /**
   * Check if a key exists in secure storage.
   */
  static async hasItem(key: string): Promise<boolean> {
    await loadCache();
    return key in cache;
  }

  // ─── Gateway Token Methods ──────────────────────────────────────

  static async setGatewayToken(gatewayId: string, token: string): Promise<void> {
    return this.setItem(`gw_${gatewayId}_token`, token);
  }

  static async getGatewayToken(gatewayId: string): Promise<string | null> {
    return this.getItem(`gw_${gatewayId}_token`);
  }

  // ─── Doubao ASR Credentials ──────────────────────────────────────

  static async setASRAppId(appId: string): Promise<void> {
    return this.setItem('asr_app_id', appId);
  }

  static async getASRAppId(): Promise<string | null> {
    return this.getItem('asr_app_id');
  }

  static async setASRAccessToken(token: string): Promise<void> {
    return this.setItem('asr_access_token', token);
  }

  static async getASRAccessToken(): Promise<string | null> {
    return this.getItem('asr_access_token');
  }

  // ─── TTS API Key Methods ─────────────────────────────────────────

  static async setTTSApiKey(key: string): Promise<void> {
    return this.setItem('tts_api_key', key);
  }

  static async getTTSApiKey(): Promise<string | null> {
    return this.getItem('tts_api_key');
  }

  static async setTTSAppId(appId: string): Promise<void> {
    return this.setItem('tts_app_id', appId);
  }

  static async getTTSAppId(): Promise<string | null> {
    return this.getItem('tts_app_id');
  }

  static async setTTSAccessToken(token: string): Promise<void> {
    return this.setItem('tts_access_token', token);
  }

  static async getTTSAccessToken(): Promise<string | null> {
    return this.getItem('tts_access_token');
  }

  static async setTTSSecretKey(secret: string): Promise<void> {
    return this.setItem('tts_secret_key', secret);
  }

  static async getTTSSecretKey(): Promise<string | null> {
    return this.getItem('tts_secret_key');
  }

  // ─── Vision Intent Model Credentials ─────────────────────────────

  static async setVisionApiKey(key: string): Promise<void> {
    return this.setItem('vision_api_key', key);
  }

  static async getVisionApiKey(): Promise<string | null> {
    return this.getItem('vision_api_key');
  }

  // ─── Device Identity (Ed25519 Keypair) ─────────────────────────

  static async setDevicePrivateKey(value: string): Promise<void> {
    return this.setItem('device_private_key', value);
  }

  static async getDevicePrivateKey(): Promise<string | null> {
    return this.getItem('device_private_key');
  }

  static async setDevicePublicKey(b64Url: string): Promise<void> {
    return this.setItem('device_public_key', b64Url);
  }

  static async getDevicePublicKey(): Promise<string | null> {
    return this.getItem('device_public_key');
  }

  static async setDeviceId(deviceId: string): Promise<void> {
    return this.setItem('device_id', deviceId);
  }

  static async getDeviceId(): Promise<string | null> {
    return this.getItem('device_id');
  }
}
