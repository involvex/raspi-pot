<script>
  import { page } from '$app/stores';
  import { logout, auth } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { socket } from '$lib/stores/socket';
  import TaskStatus from './TaskStatus.svelte';

  function handleLogout() {
      logout();
      goto('/login');
  }

  function handlePower(action) {
      if (confirm(`Are you sure you want to ${action}?`)) {
          if ($socket) $socket.emit('system:power', action);
      }
  }
</script>

<aside>
  <div class="brand">
    <span class="material-icons">memory</span>
    <div class="brand-text">
        <span class="name">RaspiPot</span>
        <span class="version">v2.4.1 stable</span>
    </div>
  </div>

  <nav>
    <div class="nav-section">
        <div class="section-title">System</div>
        <a href="/" class:active={$page.url.pathname === '/'}>
            <span class="material-icons">dashboard</span>
            Overview
        </a>
        <a href="/processes" class:active={$page.url.pathname === '/processes'}>
            <span class="material-icons">settings_applications</span>
            Processes
        </a>
        <a href="/services" class:active={$page.url.pathname === '/services'}>
            <span class="material-icons">layers</span>
            Services
        </a>
    </div>

    <div class="nav-section">
        <div class="section-title">Hardware</div>
        <a href="/gpio" class:active={$page.url.pathname === '/gpio'}>
            <span class="material-icons">settings_input_component</span>
            GPIO
        </a>
    </div>

    <div class="nav-section">
        <div class="section-title">Network</div>
        <a href="/network" class:active={$page.url.pathname === '/network'}>
            <span class="material-icons">router</span>
            Interfaces
        </a>
    </div>

    <div class="nav-section">
        <div class="section-title">Tools</div>
        <a href="/plugins" class:active={$page.url.pathname === '/plugins'}>
            <span class="material-icons">extension</span>
            Plugins
        </a>
        <a href="/cloud-storage" class:active={$page.url.pathname === '/cloud-storage'}>
            <span class="material-icons">cloud</span>
            Cloud Storage
        </a>
        <a href="/terminal" class:active={$page.url.pathname === '/terminal'}>
            <span class="material-icons">terminal</span>
            Terminal
        </a>
        <a href="/files" class:active={$page.url.pathname === '/files'}>
            <span class="material-icons">folder</span>
            Explorer
        </a>
        <a href="/scripts" class:active={$page.url.pathname === '/scripts'}>
            <span class="material-icons">play_circle</span>
            Scripts
        </a>
        <a href="/settings" class:active={$page.url.pathname === '/settings'}>
            <span class="material-icons">settings</span>
            Settings
        </a>
    </div>
  </nav>

  <TaskStatus />
  
  <div class="user-info">
      <div class="user-avatar">
          <span class="material-icons">admin_panel_settings</span>
      </div>
      <div class="user-details">
          <span class="username">{$auth.user || 'admin'}</span>
          <span class="host">root@raspberrypi</span>
      </div>
      <button class="icon-btn logout" on:click={handleLogout} title="Logout">
          <span class="material-icons">logout</span>
      </button>
  </div>

  <div class="power-actions">
      <button class="reboot" on:click={() => handlePower('reboot')}>
          <span class="material-icons">restart_alt</span>
          Reboot
      </button>
      <button class="shutdown" on:click={() => handlePower('shutdown')}>
          <span class="material-icons">power_settings_new</span>
          Shutdown
      </button>
  </div>
</aside>

<style>
  aside {
    width: 260px;
    background: #1a2233;
    border-right: 1px solid #243046;
    display: flex;
    flex-direction: column;
    height: 100vh;
    color: #f6f6f8;
  }

  .brand {
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border-bottom: 1px solid #243046;
  }
  .brand .material-icons {
      color: #2b6cee;
      font-size: 2rem;
  }
  .brand-text {
      display: flex;
      flex-direction: column;
  }
  .brand .name {
    font-size: 1.25rem;
    font-weight: bold;
    letter-spacing: -0.5px;
  }
  .brand .version {
      font-size: 0.7rem;
      color: #64748b;
  }

  nav {
    flex: 1;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    overflow-y: auto;
  }

  .nav-section {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
  }

  .section-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      margin-bottom: 0.5rem;
      padding-left: 0.75rem;
  }

  a {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.75rem;
    color: #94a3b8;
    text-decoration: none;
    border-radius: 0.5rem;
    transition: all 0.2s;
    font-size: 0.95rem;
  }
  a .material-icons {
      font-size: 1.25rem;
  }
  a:hover {
    background: #243046;
    color: #f6f6f8;
  }
  a.active {
    background: #2b6cee;
    color: white;
  }

  .user-info {
      padding: 1rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: #151c2c;
      margin: 0.5rem;
      border-radius: 0.75rem;
  }
  .user-avatar {
      width: 32px;
      height: 32px;
      background: #243046;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #2b6cee;
  }
  .user-avatar .material-icons { font-size: 1.25rem; }
  .user-details {
      flex: 1;
      display: flex;
      flex-direction: column;
  }
  .username { font-weight: 600; font-size: 0.9rem; }
  .host { font-size: 0.7rem; color: #64748b; }

  .icon-btn {
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 0.25rem;
  }
  .icon-btn:hover { color: #ef476f; background: rgba(239, 71, 111, 0.1); }

  .power-actions {
      padding: 1rem;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
      border-top: 1px solid #243046;
  }
  .power-actions button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.5rem;
      font-size: 0.75rem;
      border: 1px solid #243046;
      border-radius: 0.5rem;
      cursor: pointer;
      background: #1a2233;
      color: #94a3b8;
      transition: all 0.2s;
  }
  .power-actions button .material-icons { font-size: 1rem; }
  .reboot:hover { background: #2b6cee; color: #fff; border-color: #2b6cee; }
  .shutdown:hover { background: #ef476f; color: #fff; border-color: #ef476f; }
</style>
