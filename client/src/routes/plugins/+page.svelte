<script>
    import { onMount } from 'svelte';
    import { socket } from '$lib/stores/socket';

    /** @type {any[]} */
    let plugins = $state([]);
    let loading = $state(true);
    /** @type {string|null} */
    let error = $state(null);
    let installModal = $state(false);
    /** @type {File|null} */
    let selectedFile = $state(null);

    async function loadPlugins() {
        try {
            const response = await fetch('/api/plugins');
            const data = await response.json();
            if (data.success) {
                plugins = data.plugins || [];
            } else {
                error = data.error;
            }
        } catch (err) {
            error = /** @type {Error} */ (err).message;
        } finally {
            loading = false;
        }
    }

    async function togglePlugin(pluginName, enabled) {
        try {
            const action = enabled ? 'disable' : 'enable';
            const response = await fetch(`/api/plugins/${pluginName}/${action}`, {
                method: 'POST'
            });
            const data = await response.json();
            if (data.success) {
                await loadPlugins();
            } else {
                error = data.error;
            }
        } catch (err) {
            error = /** @type {Error} */ (err).message;
        }
    }

    async function uninstallPlugin(pluginName) {
        if (!confirm(`Are you sure you want to uninstall "${pluginName}"?`)) return;
        try {
            const response = await fetch(`/api/plugins/${pluginName}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                await loadPlugins();
            } else {
                error = data.error;
            }
        } catch (err) {
            error = /** @type {Error} */ (err).message;
        }
    }

    async function installPlugin() {
        if (!selectedFile) {
            error = 'Please select a plugin file';
            return;
        }
        try {
            const formData = new FormData();
            formData.append('plugin', selectedFile);
            const response = await fetch('/api/plugins/install', { method: 'POST', body: formData });
            const data = await response.json();
            if (data.success) {
                installModal = false;
                selectedFile = null;
                await loadPlugins();
            } else {
                error = data.error;
            }
        } catch (err) {
            error = /** @type {Error} */ (err).message;
        }
    }

    function handleOverlayClick(e) {
        if (e.target === e.currentTarget) installModal = false;
    }

    function handleKeydown(e) {
        if (e.key === 'Escape') installModal = false;
    }

    onMount(() => {
        loadPlugins();
    });
</script>

<div class="plugins-page">
    <header>
        <h1>Plugin Manager</h1>
        <button class="btn-primary" onclick={() => installModal = true}>
            <span class="material-icons">add</span>
            Install Plugin
        </button>
    </header>

    {#if error}
        <div class="error-banner">
            <span class="material-icons">error</span>
            {error}
            <button onclick={() => error = null} class="close-btn">
                <span class="material-icons">close</span>
            </button>
        </div>
    {/if}

    {#if loading}
        <div class="loading">
            <div class="spinner"></div>
            <p>Loading plugins...</p>
        </div>
    {:else if plugins.length === 0}
        <div class="empty-state">
            <span class="material-icons">extension</span>
            <h2>No plugins installed</h2>
            <p>Install plugins to extend your dashboard functionality</p>
            <button class="btn-primary" onclick={() => installModal = true}>
                Install Your First Plugin
            </button>
        </div>
    {:else}
        <div class="plugins-grid">
            {#each plugins as plugin (plugin.name)}
                <div class="plugin-card" class:enabled={plugin.enabled}>
                    <div class="plugin-header">
                        <div class="plugin-info">
                            <h3>{plugin.manifest?.name || plugin.name}</h3>
                            <p class="version">v{plugin.manifest?.version || '1.0.0'}</p>
                            <p class="description">{plugin.manifest?.description || 'No description'}</p>
                            {#if plugin.manifest?.author}
                                <p class="author">by {plugin.manifest.author}</p>
                            {/if}
                        </div>
                        <div class="plugin-status">
                            <div class="status-indicator" class:active={plugin.enabled}>
                                <span class="material-icons">
                                    {plugin.enabled ? 'check_circle' : 'radio_button_unchecked'}
                                </span>
                            </div>
                            <span class="status-text">
                                {plugin.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                    </div>
                    
                    <div class="plugin-actions">
                        <button 
                            class="btn-toggle"
                            class:enabled={plugin.enabled}
                            onclick={() => togglePlugin(plugin.name, plugin.enabled)}
                        >
                            <span class="material-icons">
                                {plugin.enabled ? 'pause' : 'play_arrow'}
                            </span>
                            {plugin.enabled ? 'Disable' : 'Enable'}
                        </button>
                        
                        <button 
                            class="btn-danger"
                            onclick={() => uninstallPlugin(plugin.name)}
                        >
                            <span class="material-icons">delete</span>
                            Uninstall
                        </button>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>

{#if installModal}
    <div class="modal-overlay" onclick={handleOverlayClick} onkeydown={handleKeydown} role="button" tabindex="-1">
        <div class="modal" role="dialog" aria-modal="true" tabindex="0" onclick={e => e.stopPropagation()} onkeydown={e => e.key === 'Enter' && e.stopPropagation()}>
            <div class="modal-header">
                <h2>Install Plugin</h2>
                <button class="close-btn" onclick={() => installModal = false}>
                    <span class="material-icons">close</span>
                </button>
            </div>
            
            <div class="modal-content">
                <p>Upload a plugin package (.zip file) to install new functionality.</p>
                <div class="file-upload">
                    <input 
                        type="file" 
                        accept=".zip,.json"
                        onchange={(e) => selectedFile = e.target.files ? e.target.files[0] : null}
                        id="plugin-file"
                    />
                    <label for="plugin-file" class="file-label">
                        <span class="material-icons">upload_file</span>
                        <span class="file-text">
                            {selectedFile ? selectedFile.name : 'Choose plugin file...'}
                        </span>
                    </label>
                </div>
            </div>
            
            <div class="modal-actions">
                <button class="btn-secondary" onclick={() => installModal = false}>Cancel</button>
                <button class="btn-primary" onclick={installPlugin} disabled={!selectedFile}>
                    Install Plugin
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .plugins-page { padding: 2.5rem; max-width: 1200px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    h1 { margin: 0; font-size: 2rem; font-weight: 700; color: #f6f6f8; }
    .error-banner { background: #ef476f22; border: 1px solid #ef476f; border-radius: 0.5rem; padding: 1rem; margin-bottom: 2rem; display: flex; align-items: center; gap: 0.5rem; color: #ef476f; }
    .close-btn { margin-left: auto; background: none; border: none; color: inherit; cursor: pointer; padding: 0.25rem; }
    .loading { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 3rem; color: #64748b; }
    .spinner { width: 2rem; height: 2rem; border: 2px solid #243046; border-top: 2px solid #2b6cee; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .empty-state { text-align: center; padding: 4rem 2rem; color: #64748b; }
    .empty-state .material-icons { font-size: 4rem; margin-bottom: 1rem; opacity: 0.5; }
    .empty-state h2 { margin: 1rem 0 0.5rem; color: #94a3b8; }
    .plugins-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1.5rem; }
    .plugin-card { background: #1a2233; border: 1px solid #243046; border-radius: 1rem; padding: 1.5rem; transition: border-color 0.2s; }
    .plugin-card.enabled { border-color: #06d6a055; }
    .plugin-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
    .plugin-info h3 { margin: 0 0 0.25rem; color: #f6f6f8; font-size: 1.25rem; }
    .version { color: #2b6cee; font-weight: 600; font-size: 0.875rem; margin: 0 0 0.5rem; }
    .description { color: #94a3b8; margin: 0 0 0.5rem; line-height: 1.4; }
    .author { color: #64748b; font-size: 0.875rem; margin: 0; }
    .plugin-status { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
    .status-indicator.active { color: #06d6a0; }
    .status-text { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .plugin-actions { display: flex; gap: 0.5rem; }
    .btn-primary, .btn-secondary, .btn-toggle, .btn-danger { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-primary { background: #2b6cee; color: white; }
    .btn-primary:hover { background: #1e5bcc; }
    .btn-secondary { background: #243046; color: #94a3b8; }
    .btn-secondary:hover { background: #2d3748; }
    .btn-toggle { background: #243046; color: #94a3b8; flex: 1; }
    .btn-toggle.enabled { background: #06d6a0; color: white; }
    .btn-danger { background: #ef476f; color: white; }
    .btn-danger:hover { background: #dc2626; }
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: #1a2233; border: 1px solid #243046; border-radius: 1rem; padding: 0; max-width: 500px; width: 90%; max-height: 90vh; overflow: auto; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid #243046; }
    .modal-header h2 { margin: 0; color: #f6f6f8; }
    .modal-content { padding: 1.5rem; }
    .modal-actions { display: flex; gap: 1rem; justify-content: flex-end; padding: 1.5rem; border-top: 1px solid #243046; }
    .file-upload { margin-top: 1rem; }
    .file-upload input[type="file"] { display: none; }
    .file-label { display: flex; align-items: center; gap: 0.5rem; padding: 2rem; border: 2px dashed #243046; border-radius: 0.5rem; cursor: pointer; transition: border-color 0.2s; }
    .file-label:hover { border-color: #2b6cee; }
    .file-text { color: #94a3b8; }
</style>
