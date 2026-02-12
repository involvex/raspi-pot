import { writable } from 'svelte/store';

function createTasksStore() {
  const { subscribe, update } = writable([]);

  return {
    subscribe,
    add: (id, name, type = 'upload') =>
      update(tasks => [...tasks, { id, name, type, progress: 0, status: 'active' }]),
    updateProgress: (id, progress) =>
      update(tasks => tasks.map(t => (t.id === id ? { ...t, progress } : t))),
    complete: id =>
      update(tasks =>
        tasks.map(t => (t.id === id ? { ...t, status: 'completed', progress: 100 } : t))
      ),
    remove: id => update(tasks => tasks.filter(t => t.id !== id)),
    error: (id, message) =>
      update(tasks => tasks.map(t => (t.id === id ? { ...t, status: 'error', message } : t)))
  };
}

export const tasks = createTasksStore();
