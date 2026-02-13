<script>
    import { onMount } from 'svelte';
    import { settings } from '$lib/stores/settings';
    
    let activeTab = $state('gdrive');
    /** @type {any[]} */
    let gdriveFiles = $state([]);
    /** @type {any[]} */
    let megaFiles = $state([]);
    let loading = $state(false);
    /** @type {string|null} */
    let error = $state(null);
    let uploadModal = $state(false);
    /** @type {File|null} */
    let selectedFile = $state(null);
    let settingsModal = $state(false);
    
    // Google Drive state
    let gdriveAuthenticated = $state(false);
    let gdriveConfigured = $state(false);
    /** @type {string|null} */
    let gdriveAuthUrl = $state(null);
    
    // Mega state
    let megaAuthenticated = $state(false);
    let megaConfigured = $state(false);
    let megaCredentials = $state({ email: '', password: '' });

    async function loadFiles(service) {
        loading = true;
        error = null;
        try {
            const response = await fetch(`/api/cloud-storage/${service}/list`);
            const data = await response.json();
            if (data.success) {
                if (service === 'gdrive') gdriveFiles = data.files || [];
                else megaFiles = data.files || [];
            } else {
                error = data.error;
            }
        } catch (err) {
            error = /** @type {Error} */ (err).message;
        } finally {
            loading = false;
        }
    }

    async function checkStatus(service) {
        try {
            const response = await fetch(`/api/cloud-storage/${service}/status`);
            const data = await response.json();
            if (data.success) {
                if (service === 'gdrive') {
                    gdriveAuthenticated = data.authenticated;
                    gdriveConfigured = data.configured;
                } else {
                    megaAuthenticated = data.authenticated;
                    megaConfigured = data.configured;
                }
            }
        } catch (err) {
            error = /** @type {Error} */ (err).message;
        }
    }

    async function authenticateGDrive() {
        try {
            const response = await fetch('/api/cloud-storage/gdrive/auth');
            const data = await response.json();
            if (data.success) {
                gdriveAuthUrl = data.authUrl;
                window.open(data.authUrl, '_blank', 'width=500,height=600');
            } else {
                error = data.error;
            }
        } catch (err) {
            error = /** @type {Error} */ (err).message;
        }
    }

    async function loginMega(e) {
        if (e) e.preventDefault();
        loading = true;
        error = null;
        try {
            const response = await fetch('/api/cloud-storage/mega/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(megaCredentials)
            });
            const data = await response.json();
            if (data.success) {
                megaAuthenticated = true;
                settings.update(s => {
                    s.mega.email = megaCredentials.email;
                    s.mega.enabled = true;
                    return s;
                });
                await loadFiles('mega');
            } else {
                error = data.error;
            }
        } catch (err) {
            error = /** @type {Error} */ (err).message;
        } finally {
            loading = false;
        }
    }

    async function uploadFile(service) {
        if (!selectedFile) {
            error = 'Please select a file to upload';
            return;
        }
        loading = true;
        error = null;
        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            const response = await fetch(`/api/cloud-storage/${service}/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                uploadModal = false;
                selectedFile = null;
                await loadFiles(service);
            } else {
                error = data.error;
            }
        } catch (err) {
            error = /** @type {Error} */ (err).message;
        } finally {
            loading = false;
        }
    }

    async function downloadFile(service, fileId, fileName) {
        try {
            const response = await fetch(`/api/cloud-storage/${service}/download?fileId=${fileId}`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            } else {
                error = 'Download failed';
            }
        } catch (err) {
            error = /** @type {Error} */ (err).message;
        }
    }

    async function deleteFile(service, fileId) {
        if (!confirm('Are you sure you want to delete this file?')) return;
        try {
            const response = await fetch(`/api/cloud-storage/${service}/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId })
            });
            const data = await response.json();
            if (data.success) await loadFiles(service);
            else error = data.error;
        } catch (err) {
            error = /** @type {Error} */ (err).message;
        }
    }

    function formatFileSize(bytes) {
        const b = typeof bytes === 'string' ? parseInt(bytes) : bytes;
        if (!b) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(b) / Math.log(k));
        return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function formatDate(dateString) {
        if (!dateString) return 'Unknown';
        return new Date(dateString).toLocaleString();
    }

    async function saveSettings() {
        loading = true;
        try {
            const response = await fetch('/api/plugins/cloud-storage/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify($settings)
            });
            const data = await response.json();
            if (data.success) {
                settingsModal = false;
                error = null;
                await checkStatus('gdrive');
                await checkStatus('mega');
            } else {
                error = data.error || 'Failed to save settings';
            }
        } catch (err) {
            error = /** @type {Error} */ (err).message;
        } finally {
            loading = false;
        }
    }

    function handleOverlayClick(e) {
        if (e.target === e.currentTarget) {
            uploadModal = false;
            settingsModal = false;
        }
    }

    function handleKeydown(e) {
        if (e.key === 'Escape') {
            uploadModal = false;
            settingsModal = false;
        }
    }

    onMount(async () => {
        if (!$settings.gdrive) {
            settings.update(s => ({
                ...s,
                gdrive: { clientId: '', clientSecret: '', enabled: false, redirectUri: 'http://localhost:3000/api/cloud-storage/gdrive/callback' },
                mega: { email: '', password: '', enabled: false }
            }));
        }
        await Promise.all([checkStatus('gdrive'), checkStatus('mega')]);
    });
</script>

<div class="cloud-storage-page">
    <header>
        <h1>Cloud Storage</h1>
        <button class="btn-primary" onclick={() => settingsModal = true}>
            <span class="material-icons">settings</span>
            Settings
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

    <div class="tabs">
        <button class="tab-btn" class:active={activeTab === 'gdrive'} onclick={() => activeTab = 'gdrive'}>
            <span class="material-icons">cloud</span>
            Google Drive
            <span class="status-indicator" class:authenticated={gdriveAuthenticated}></span>
        </button>
        <button class="tab-btn" class:active={activeTab === 'mega'} onclick={() => activeTab = 'mega'}>
            <span class="material-icons">cloud_queue</span>
            Mega
            <span class="status-indicator" class:authenticated={megaAuthenticated}></span>
        </button>
    </div>

    {#if activeTab === 'gdrive'}
        <div class="tab-content">
            {#if !gdriveAuthenticated}
                <div class="auth-section">
                    <div class="auth-card">
                        <h3>Connect to Google Drive</h3>
                        <p>Connect your Google Drive account to manage files in the cloud.</p>
                        {#if !gdriveConfigured}
                            <div class="config-warning">
                                <span class="material-icons">warning</span>
                                <p>Google Drive is not configured. Please add your API credentials in Settings.</p>
                            </div>
                        {:else if gdriveAuthUrl}
                            <div class="auth-success">
                                <span class="material-icons">open_in_new</span>
                                <p>Authentication window opened. Please complete the authentication and return here.</p>
                                <button class="btn-secondary" onclick={authenticateGDrive}>Reopen Authentication</button>
                            </div>
                        {:else}
                            <button class="btn-primary" onclick={authenticateGDrive}>
                                <span class="material-icons">login</span>
                                Connect to Google Drive
                            </button>
                        {/if}
                    </div>
                </div>
            {:else}
                <div class="toolbar">
                    <button class="btn-primary" onclick={() => { uploadModal = true; activeTab = 'gdrive'; }}>
                        <span class="material-icons">upload</span>
                        Upload File
                    </button>
                    <button class="btn-secondary" onclick={() => loadFiles('gdrive')}>
                        <span class="material-icons">refresh</span>
                        Refresh
                    </button>
                </div>
                {#if loading}
                    <div class="loading"><div class="spinner"></div><p>Loading files...</p></div>
                {:else if gdriveFiles.length === 0}
                    <div class="empty-state"><span class="material-icons">folder_open</span><h3>No files found</h3><p>Upload some files to get started</p></div>
                {:else}
                    <div class="file-list">
                        {#each gdriveFiles as file (file.id)}
                            <div class="file-item">
                                <div class="file-info">
                                    <span class="material-icons file-icon">{file.type === 'folder' ? 'folder' : 'insert_drive_file'}</span>
                                    <div class="file-details">
                                        <div class="file-name">{file.name}</div>
                                        <div class="file-meta">{formatFileSize(file.size)} • {formatDate(file.modifiedTime)}</div>
                                    </div>
                                </div>
                                <div class="file-actions">
                                    <button class="btn-icon" onclick={() => downloadFile('gdrive', file.id, file.name)} title="Download"><span class="material-icons">download</span></button>
                                    <button class="btn-icon btn-danger" onclick={() => deleteFile('gdrive', file.id)} title="Delete"><span class="material-icons">delete</span></button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            {/if}
        </div>
    {/if}

    {#if activeTab === 'mega'}
        <div class="tab-content">
            {#if !megaAuthenticated}
                <div class="auth-section">
                    <div class="auth-card">
                        <h3>Connect to Mega</h3>
                        <p>Enter your Mega credentials to access your cloud storage.</p>
                        <form onsubmit={loginMega}>
                            <div class="form-group">
                                <label for="mega-email">Email</label>
                                <input type="email" id="mega-email" bind:value={megaCredentials.email} required />
                            </div>
                            <div class="form-group">
                                <label for="mega-password">Password</label>
                                <input type="password" id="mega-password" bind:value={megaCredentials.password} required />
                            </div>
                            <button type="submit" class="btn-primary" disabled={loading}>
                                <span class="material-icons">login</span>
                                {loading ? 'Connecting...' : 'Connect to Mega'}
                            </button>
                        </form>
                    </div>
                </div>
            {:else}
                <div class="toolbar">
                    <button class="btn-primary" onclick={() => { uploadModal = true; activeTab = 'mega'; }}>
                        <span class="material-icons">upload</span>
                        Upload File
                    </button>
                    <button class="btn-secondary" onclick={() => loadFiles('mega')}>
                        <span class="material-icons">refresh</span>
                        Refresh
                    </button>
                </div>
                {#if loading}
                    <div class="loading"><div class="spinner"></div><p>Loading files...</p></div>
                {:else if megaFiles.length === 0}
                    <div class="empty-state"><span class="material-icons">folder_open</span><h3>No files found</h3><p>Upload some files to get started</p></div>
                {:else}
                    <div class="file-list">
                        {#each megaFiles as file (file.id)}
                            <div class="file-item">
                                <div class="file-info">
                                    <span class="material-icons file-icon">{file.type === 'folder' ? 'folder' : 'insert_drive_file'}</span>
                                    <div class="file-details">
                                        <div class="file-name">{file.name}</div>
                                        <div class="file-meta">{formatFileSize(file.size)} • {formatDate(file.modifiedTime)}</div>
                                    </div>
                                </div>
                                <div class="file-actions">
                                    <button class="btn-icon" onclick={() => downloadFile('mega', file.id, file.name)} title="Download"><span class="material-icons">download</span></button>
                                    <button class="btn-icon btn-danger" onclick={() => deleteFile('mega', file.id)} title="Delete"><span class="material-icons">delete</span></button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            {/if}
        </div>
    {/if}
</div>

{#if uploadModal}
    <div class="modal-overlay" onclick={handleOverlayClick} onkeydown={handleKeydown} role="button" tabindex="-1">
        <div class="modal" role="dialog" aria-modal="true" tabindex="0" onclick={e => e.stopPropagation()} onkeydown={e => e.key === 'Enter' && e.stopPropagation()}>
            <div class="modal-header">
                <h2>Upload File to {activeTab === 'gdrive' ? 'Google Drive' : 'Mega'}</h2>
                <button class="close-btn" onclick={() => uploadModal = false} aria-label="Close upload dialog"><span class="material-icons">close</span></button>
            </div>
            <div class="modal-content">
                <div class="file-upload">
                    <input type="file" id="upload-file" accept="*/*" onchange={(e) => selectedFile = e.target.files ? e.target.files[0] : null} aria-label="Select file to upload" />
                    <label for="upload-file" class="file-label">
                        <span class="material-icons">upload_file</span>
                        <span class="file-text">{selectedFile ? selectedFile.name : 'Choose file to upload...'}</span>
                    </label>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn-secondary" onclick={() => uploadModal = false}>Cancel</button>
                <button class="btn-primary" onclick={() => uploadFile(activeTab)} disabled={!selectedFile}>{loading ? 'Uploading...' : 'Upload'}</button>
            </div>
        </div>
    </div>
{/if}

{#if settingsModal}
    <div class="modal-overlay" onclick={handleOverlayClick} onkeydown={handleKeydown} role="button" tabindex="-1">
        <div class="modal" role="dialog" aria-modal="true" tabindex="0" onclick={e => e.stopPropagation()} onkeydown={e => e.key === 'Enter' && e.stopPropagation()}>
            <div class="modal-header">
                <h2>Cloud Storage Settings</h2>
                <button class="close-btn" onclick={() => settingsModal = false} aria-label="Close settings dialog"><span class="material-icons">close</span></button>
            </div>
            <div class="modal-content">
                <div class="settings-section">
                    <h3>Google Drive</h3>
                    <div class="form-group">
                        <label for="gdrive-client-id">Client ID</label>
                        <input type="text" id="gdrive-client-id" bind:value={$settings.gdrive.clientId} placeholder="Your Google Drive Client ID" />
                    </div>
                    <div class="form-group">
                        <label for="gdrive-client-secret">Client Secret</label>
                        <input type="password" id="gdrive-client-secret" bind:value={$settings.gdrive.clientSecret} placeholder="Your Google Drive Client Secret" />
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" bind:checked={$settings.gdrive.enabled} /> Enable Google Drive</label>
                    </div>
                </div>
                <div class="settings-section">
                    <h3>Mega</h3>
                    <div class="form-group">
                        <label for="mega-email">Email</label>
                        <input type="email" id="mega-email" bind:value={$settings.mega.email} placeholder="your-email@mega.nz" />
                    </div>
                    <div class="form-group">
                        <label for="mega-password">Password</label>
                        <input type="password" id="mega-password" bind:value={$settings.mega.password} placeholder="Your Mega password" />
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" bind:checked={$settings.mega.enabled} /> Enable Mega</label>
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn-secondary" onclick={() => settingsModal = false}>Cancel</button>
                <button class="btn-primary" onclick={saveSettings}>Save Settings</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .cloud-storage-page { padding: 2.5rem; max-width: 1200px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    h1 { margin: 0; font-size: 2rem; font-weight: 700; color: #f6f6f8; }
    .error-banner { background: #ef476f22; border: 1px solid #ef476f; border-radius: 0.5rem; padding: 1rem; margin-bottom: 2rem; display: flex; align-items: center; gap: 0.5rem; color: #ef476f; }
    .close-btn { margin-left: auto; background: none; border: none; color: inherit; cursor: pointer; padding: 0.25rem; }
    .tabs { display: flex; gap: 1rem; margin-bottom: 2rem; border-bottom: 1px solid #243046; }
    .tab-btn { display: flex; align-items: center; gap: 0.5rem; padding: 1rem 1.5rem; background: none; border: none; border-bottom: 2px solid transparent; color: #94a3b8; cursor: pointer; transition: all 0.2s; font-size: 1rem; font-weight: 500; }
    .tab-btn:hover { color: #f6f6f8; background: #243046; }
    .tab-btn.active { color: #2b6cee; border-bottom-color: #2b6cee; }
    .status-indicator { width: 8px; height: 8px; border-radius: 50%; background: #64748b; }
    .status-indicator.authenticated { background: #06d6a0; }
    .tab-content { min-height: 400px; }
    .auth-section { display: flex; justify-content: center; align-items: center; min-height: 300px; }
    .auth-card { background: #1a2233; border: 1px solid #243046; border-radius: 1rem; padding: 2rem; text-align: center; max-width: 400px; width: 100%; }
    .auth-card h3 { margin: 0 0 1rem; color: #f6f6f8; }
    .auth-card p { color: #94a3b8; margin-bottom: 1.5rem; }
    .config-warning { background: #ffd16622; border: 1px solid #ffd166; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1.5rem; color: #ffd166; display: flex; align-items: center; gap: 0.5rem; }
    .auth-success { background: #06d6a022; border: 1px solid #06d6a0; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1.5rem; color: #06d6a0; display: flex; align-items: center; gap: 0.5rem; }
    .form-group { margin-bottom: 1rem; text-align: left; }
    .form-group label { display: block; margin-bottom: 0.5rem; color: #94a3b8; font-weight: 500; }
    .form-group input { width: 100%; padding: 0.75rem; background: #243046; border: 1px solid #364152; border-radius: 0.5rem; color: #f6f6f8; font-size: 0.95rem; }
    .form-group input:focus { outline: none; border-color: #2b6cee; }
    .toolbar { display: flex; gap: 1rem; margin-bottom: 2rem; }
    .btn-primary, .btn-secondary, .btn-icon { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-primary { background: #2b6cee; color: white; }
    .btn-primary:hover { background: #1e5bcc; }
    .btn-secondary { background: #243046; color: #94a3b8; }
    .btn-secondary:hover { background: #2d3748; }
    .btn-icon { padding: 0.5rem; background: #243046; color: #94a3b8; }
    .btn-icon:hover { background: #2d3748; }
    .btn-icon.btn-danger { color: #ef476f; }
    .btn-icon.btn-danger:hover { background: #ef476f; color: white; }
    .loading { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 3rem; color: #64748b; }
    .spinner { width: 2rem; height: 2rem; border: 2px solid #243046; border-top: 2px solid #2b6cee; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .empty-state { text-align: center; padding: 4rem 2rem; color: #64748b; }
    .empty-state .material-icons { font-size: 4rem; margin-bottom: 1rem; opacity: 0.5; }
    .file-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .file-item { background: #1a2233; border: 1px solid #243046; border-radius: 0.5rem; padding: 1rem; display: flex; justify-content: space-between; align-items: center; transition: border-color 0.2s; }
    .file-item:hover { border-color: #2b6cee55; }
    .file-info { display: flex; align-items: center; gap: 1rem; flex: 1; }
    .file-icon { color: #2b6cee; font-size: 1.5rem; }
    .file-details { flex: 1; }
    .file-name { color: #f6f6f8; font-weight: 500; margin-bottom: 0.25rem; }
    .file-meta { color: #64748b; font-size: 0.875rem; }
    .file-actions { display: flex; gap: 0.5rem; }
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
    .settings-section { margin-bottom: 2rem; }
    .settings-section h3 { margin: 0 0 1rem; color: #f6f6f8; border-bottom: 1px solid #243046; padding-bottom: 0.5rem; }
    .settings-section .form-group { margin-bottom: 1rem; }
    .settings-section label { display: flex; align-items: center; gap: 0.5rem; color: #94a3b8; font-weight: 500; }
    .settings-section input[type="checkbox"] { width: auto; }
</style>
