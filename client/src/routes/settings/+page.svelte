<script>
    import { socket } from '$lib/stores/socket';
    import { onMount } from 'svelte';

    let currentPassword = $state('');
    let newPassword = $state('');
    let confirmPassword = $state('');
    let error = $state('');

    let telemetryInterval = $state(2000);
    let processInterval = $state(10000);

    async function updatePassword() {
        error = '';
        if (!currentPassword || !newPassword) {
            error = 'All fields are required';
            return;
        }
        if (newPassword !== confirmPassword) {
            error = 'New passwords do not match';
            return;
        }
        if (newPassword.length < 4) {
            error = 'Password must be at least 4 characters';
            return;
        }

        socket.subscribe(s => {
            if (s) {
                s.emit('settings:update_password', { currentPassword, newPassword });
                currentPassword = '';
                newPassword = '';
                confirmPassword = '';
            }
        })();
    }
</script>

<div class="page">
    <header>
        <div class="title-group">
            <h1>Settings</h1>
            <p class="subtitle">Manage your RaspiPot configuration</p>
        </div>
    </header>

    <div class="grid">
        <!-- Security Settings -->
        <section class="card">
            <div class="card-header">
                <span class="material-icons">security</span>
                <h2>Security</h2>
            </div>
            <div class="card-body">
                <form onsubmit={e => { e.preventDefault(); updatePassword(); }}>
                    <div class="form-group">
                        <label for="curr">Current Password</label>
                        <input type="password" id="curr" bind:value={currentPassword} />
                    </div>
                    <div class="form-group">
                        <label for="new">New Password</label>
                        <input type="password" id="new" bind:value={newPassword} />
                    </div>
                    <div class="form-group">
                        <label for="conf">Confirm New Password</label>
                        <input type="password" id="conf" bind:value={confirmPassword} />
                    </div>
                    
                    {#if error}
                        <p class="error-msg">{error}</p>
                    {/if}

                    <button type="submit" class="btn-primary">Update Password</button>
                </form>
            </div>
        </section>

        <!-- System Preferences -->
        <section class="card">
            <div class="card-header">
                <span class="material-icons">tune</span>
                <h2>Performance</h2>
            </div>
            <div class="card-body">
                <div class="setting-item">
                    <div class="info">
                        <span class="label">Telemetry Refresh Rate</span>
                        <span class="desc">How often the dashboard updates stats (ms)</span>
                    </div>
                    <input type="number" bind:value={telemetryInterval} step="500" min="500" />
                </div>
                <div class="setting-item">
                    <div class="info">
                        <span class="label">Process List Refresh</span>
                        <span class="desc">How often the process table updates (ms)</span>
                    </div>
                    <input type="number" bind:value={processInterval} step="1000" min="1000" />
                </div>
                <p class="hint">Note: These settings are currently session-based and help optimize performance on older Pi models.</p>
            </div>
        </section>

        <!-- About -->
        <section class="card about-card">
            <div class="card-header">
                <span class="material-icons">info</span>
                <h2>About RaspiPot</h2>
            </div>
            <div class="card-body">
                <div class="brand">
                    <span class="material-icons">memory</span>
                    <h3>RaspiPot v2.4.1</h3>
                </div>
                <p>An open-source, high-fidelity Raspberry Pi dashboard for real-time monitoring and management.</p>
                <div class="meta">
                    <span>OS: Linux (Raspbian)</span>
                    <span>Node.js: {typeof process !== 'undefined' ? process.version : 'v18.x'}</span>
                </div>
            </div>
        </section>
    </div>
</div>

<style>
    .page { padding: 2.5rem; max-width: 1400px; margin: 0 auto; }
    header { margin-bottom: 2.5rem; }
    h1 { margin: 0; font-size: 2rem; font-weight: 700; color: #f6f6f8; }
    .subtitle { margin: 0.25rem 0 0 0; color: #64748b; font-size: 0.95rem; }

    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 2rem;
    }

    .card {
        background: #1a2233;
        border-radius: 1rem;
        border: 1px solid #243046;
        overflow: hidden;
    }

    .card-header {
        padding: 1.25rem;
        background: #151c2c;
        border-bottom: 1px solid #243046;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        color: #2b6cee;
    }
    .card-header h2 { margin: 0; font-size: 1rem; color: #f6f6f8; text-transform: uppercase; letter-spacing: 1px; }

    .card-body { padding: 1.5rem; }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 1.25rem;
    }
    label { font-size: 0.85rem; color: #64748b; font-weight: 600; }
    input {
        background: #151c2c;
        border: 1px solid #243046;
        color: #f6f6f8;
        padding: 0.75rem 1rem;
        border-radius: 0.75rem;
        outline: none;
        transition: border-color 0.2s;
    }
    input:focus { border-color: #2b6cee; }

    .btn-primary {
        width: 100%;
        background: #2b6cee;
        color: white;
        border: none;
        padding: 0.75rem;
        border-radius: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
        margin-top: 0.5rem;
    }
    .btn-primary:hover { background: #1e56cc; }

    .error-msg { color: #ef476f; font-size: 0.85rem; margin-bottom: 1rem; }

    .setting-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        gap: 1rem;
    }
    .setting-item .info { display: flex; flex-direction: column; }
    .setting-item .label { font-weight: 600; color: #cbd5e1; font-size: 0.95rem; }
    .setting-item .desc { font-size: 0.8rem; color: #64748b; }
    .setting-item input { width: 100px; text-align: center; }

    .hint { font-size: 0.75rem; color: #475569; font-style: italic; }

    .brand { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
    .brand .material-icons { font-size: 2.5rem; color: #2b6cee; }
    .brand h3 { margin: 0; font-size: 1.25rem; color: #f6f6f8; }
    .about-card p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
    .meta { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1.5rem; font-family: monospace; font-size: 0.85rem; color: #64748b; }
</style>
