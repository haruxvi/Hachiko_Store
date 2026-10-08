import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// El refresh token vive en el llavero cifrado del sistema (Android Keystore /
// iOS Keychain). En la vista previa web no existe ese llavero: se usa
// sessionStorage, que se borra al cerrar la pestaña (solo para desarrollo).
const web = Platform.OS === 'web';

export async function secureGet(key: string): Promise<string | null> {
  if (web) {
    try {
      return globalThis.sessionStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (web) {
    try {
      globalThis.sessionStorage?.setItem(key, value);
    } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
}

export async function secureDelete(key: string): Promise<void> {
  if (web) {
    try {
      globalThis.sessionStorage?.removeItem(key);
    } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
