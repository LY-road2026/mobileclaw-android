import { Platform } from 'react-native';

export interface GatewayPlatformIdentity {
  clientId: 'openclaw-ios' | 'openclaw-android';
  platform: 'ios' | 'android';
  deviceFamily: string;
  userAgent: string;
}

export function getGatewayPlatformIdentity(): GatewayPlatformIdentity {
  if (Platform.OS === 'android') {
    return {
      clientId: 'openclaw-android',
      platform: 'android',
      deviceFamily: 'Android',
      userAgent: 'mobileclaw-android/1.0.0',
    };
  }

  return {
    clientId: 'openclaw-ios',
    platform: 'ios',
    deviceFamily: 'iPhone',
    userAgent: 'mobileclaw-ios/1.0.0',
  };
}
