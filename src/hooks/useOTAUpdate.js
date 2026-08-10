import { useState, useEffect, useCallback } from 'react';
import * as Updates from 'expo-updates';

export function useOTAUpdate() {
  const [isChecking, setIsChecking] = useState(false);
  const [updateMessage, setUpdateMessage] = useState(null);

  const checkForUpdate = useCallback(async () => {
    if (__DEV__) return;

    try {
      setIsChecking(true);
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setUpdateMessage('Downloading update...');
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      }
    } catch (e) {
      console.error('OTA update error:', e);
    } finally {
      setIsChecking(false);
      setUpdateMessage(null);
    }
  }, []);

  useEffect(() => {
    checkForUpdate();
  }, []);

  return { isChecking, updateMessage, checkForUpdate };
}
