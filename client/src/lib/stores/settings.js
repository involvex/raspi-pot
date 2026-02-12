import { writable } from 'svelte/store';

function createSettingsStore() {
  // Load settings from localStorage if available
  const storedSettings =
    typeof localStorage !== 'undefined'
      ? JSON.parse(localStorage.getItem('cloud-storage-settings') || '{}')
      : {};

  const { subscribe, set, update } = writable({
    gdrive: {
      clientId: '',
      clientSecret: '',
      enabled: false,
      redirectUri: 'http://localhost:3000/api/cloud-storage/gdrive/callback',
      ...storedSettings.gdrive
    },
    mega: {
      email: '',
      password: '',
      enabled: false,
      ...storedSettings.mega
    },
    uploadPath: './uploads',
    maxFileSize: '100MB',
    ...storedSettings
  });

  return {
    subscribe,
    set: value => {
      // Save to localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('cloud-storage-settings', JSON.stringify(value));
      }
      set(value);
    },
    update: updater => {
      update(currentValue => {
        const newValue = updater(currentValue);
        // Save to localStorage
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('cloud-storage-settings', JSON.stringify(newValue));
        }
        return newValue;
      });
    }
  };
}

export const settings = createSettingsStore();
