import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const storedToken = browser ? localStorage.getItem('token') : null;

export const auth = writable({
  isAuthenticated: !!storedToken,
  token: storedToken
});

auth.subscribe(value => {
  if (browser) {
    if (value.token) {
      localStorage.setItem('token', value.token);
    } else {
      localStorage.removeItem('token');
    }
  }
});

export function login(token) {
  auth.set({ isAuthenticated: true, token });
}

export function logout() {
  auth.set({ isAuthenticated: false, token: null });
}
