import { writable } from 'svelte/store';
import io from 'socket.io-client';
import { auth } from './auth';

export const socket = writable(null);

auth.subscribe($auth => {
  if ($auth.token) {
    const url = `http://${window.location.hostname}:3000`;
    const s = io(url, { auth: { token: $auth.token } });
    socket.set(s);
  } else {
    socket.update(s => {
      if (s) s.disconnect();
      return null;
    });
  }
});
