<script>
  import { login } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';

  let password = $state('');
  let error = $state('');

  // Redirect if already logged in
  onMount(() => {
    const unsubscribe = auth.subscribe(state => {
        if (state.isAuthenticated) {
            goto('/');
        }
    });
    return unsubscribe;
  });

  async function handleSubmit(e) {
    e.preventDefault();
    error = '';
    try {
        const apiUrl = `http://${window.location.hostname}:3000/api/login`;
        
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await res.json();

        if (data.success) {
            login(data.token);
            goto('/');
        } else {
            error = data.message || 'Login failed';
        }
    } catch (e) {
        error = 'Network error or server offline';
    }
  }
</script>

<div class="login-container">
  <div class="card">
    <div class="brand">
        <span class="material-icons">memory</span>
        <h1>RaspiPot</h1>
    </div>
    <p class="subtitle">Secure System Dashboard Access</p>

    <form onsubmit={handleSubmit}>
      <div class="input-group">
          <span class="material-icons">lock</span>
          <input 
            type="password" 
            bind:value={password} 
            placeholder="System Password" 
          />
      </div>
      <button type="submit">
          Unlock System
          <span class="material-icons">arrow_forward</span>
      </button>
    </form>
    
    {#if error}
      <p class="error">
          <span class="material-icons">error_outline</span>
          {error}
      </p>
    {/if}

    <div class="footer">
        <p>© 2026 Raspberry Pi Cluster Manager</p>
    </div>
  </div>
</div>

<style>
  .login-container { display: flex; justify-content: center; align-items: center; height: 100vh; background: #101622; }
  .card { background: #1a2233; padding: 3rem; border-radius: 1.5rem; border: 1px solid #243046; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3); text-align: center; width: 400px; }
  .brand { display: flex; align-items: center; justify-content: center; gap: 0.75rem; margin-bottom: 0.5rem; }
  .brand .material-icons { color: #2b6cee; font-size: 2.5rem; }
  h1 { margin: 0; font-size: 2rem; font-weight: 700; color: #f6f6f8; }
  .subtitle { color: #64748b; margin-bottom: 2.5rem; font-size: 0.95rem; }
  .input-group { position: relative; display: flex; align-items: center; margin-bottom: 1.5rem; }
  .input-group .material-icons { position: absolute; left: 1rem; color: #64748b; font-size: 1.25rem; }
  input { width: 100%; padding: 1rem 1rem 1rem 3rem; background: #151c2c; border: 1px solid #243046; color: #f6f6f8; border-radius: 0.75rem; font-size: 1rem; transition: all 0.2s; outline: none; }
  input:focus { border-color: #2b6cee; background: #1e293b; box-shadow: 0 0 0 4px rgba(43, 108, 238, 0.1); }
  button { width: 100%; padding: 1rem; background: #2b6cee; color: white; border: none; border-radius: 0.75rem; cursor: pointer; font-weight: 600; font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s; }
  button:hover { background: #1e56cc; transform: translateY(-1px); }
  .error { color: #ef476f; margin-top: 1.5rem; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 0.4rem; background: rgba(239, 71, 111, 0.1); padding: 0.75rem; border-radius: 0.5rem; }
  .footer { margin-top: 3rem; color: #475569; font-size: 0.8rem; }
</style>
