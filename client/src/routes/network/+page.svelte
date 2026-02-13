<script>
    import { onMount, onDestroy } from 'svelte';
    import { socket } from '$lib/stores/socket';

    /** @type {any[]} */
    let availableNetworks = $state([]);
    /** @type {any[]} */
    let savedConnections = $state([]);
    let ips = $state([]);
    let scanning = $state(false);
    let unsubscribe;

    let showConnectModal = $state(false);
    let selectedSsid = $state('');
    let password = $state('');

    function handleTelemetry(data) {
        if (data && Array.isArray(data.ips)) {
            ips = data.ips;
        }
    }

    onMount(() => {
        unsubscribe = socket.subscribe(s => {
            if (s) {
                s.emit('network:scan');
                s.emit('network:get_saved');

                s.on('telemetry:stats', handleTelemetry);

                s.on('network:scan_results', (data) => {
                    availableNetworks = Array.isArray(data) ? data : [];
                    scanning = false;
                });

                s.on('network:saved_results', (data) => {
                    savedConnections = Array.isArray(data) ? data : [];
                });

                s.on('network:refresh', () => {
                    s.emit('network:scan');
                    s.emit('network:get_saved');
                });
            }
        });
    });

    onDestroy(() => {
        if (unsubscribe) unsubscribe();
        socket.subscribe(s => {
            if (s) {
                s.off('network:scan_results');
                s.off('network:saved_results');
                s.off('network:refresh');
                s.off('telemetry:stats', handleTelemetry);
            }
        })();
    });

    function getSignalIcon(signal) {
        if (signal >= 75) return 'signal_wifi_4_bar';
        if (signal >= 50) return 'network_wifi_3_bar';
        if (signal >= 25) return 'network_wifi_2_bar';
        return 'network_wifi_1_bar';
    }

    function scan() {
        socket.subscribe(s => {
            if (s) {
                scanning = true;
                s.emit('network:scan');
            }
        })();
    }

    function openConnect(ssid) {
        selectedSsid = ssid;
        password = '';
        showConnectModal = true;
    }

    function connect() {
        socket.subscribe(s => {
            if (s) {
                s.emit('network:connect', { ssid: selectedSsid, password });
                showConnectModal = false;
            }
        })();
    }

    function deleteConnection(name) {
        if (!name) return;
        if (confirm(`Delete connection "${name}"?`)) {
            socket.subscribe(s => {
                if (s) s.emit('network:delete', name);
            })();
        }
    }

    function handleOverlayClick(e) {
        if (e.target === e.currentTarget) showConnectModal = false;
    }

    function handleKeydown(e) {
        if (e.key === 'Escape') showConnectModal = false;
    }
</script>

<div class="page">
    <header>
        <div class="title-group">
            <h1>Network Manager</h1>
            <div class="status-pill">
                <span class="dot pulse"></span>
                <span class="status-text">Online</span>
                <div class="ip-list">
                    {#if ips && ips.length > 0}
                        {#each ips as item (item.iface)}
                            <span class="ip-tag">
                                <span class="iface">{item.iface || 'unk'}:</span>
                                {item.ip || '0.0.0.0'}
                            </span>
                        {/each}
                    {:else}
                        <span class="ip-tag disconnected">Disconnected</span>
                    {/if}
                </div>
            </div>
        </div>
        <button class="btn-refresh" onclick={scan} disabled={scanning}>
            <span class="material-icons" class:spinning={scanning}>refresh</span>
            {scanning ? 'Scanning...' : 'Scan WiFi'}
        </button>
    </header>

    <div class="grid">
        <section class="card">
            <div class="card-header">
                <span class="material-icons">wifi</span>
                <h2>Available Networks</h2>
            </div>
            <div class="list">
                {#each availableNetworks as net (net.ssid || Math.random())}
                    <div class="item" class:connected={net.connected}>
                        <div class="item-info">
                            <div class="name-group">
                                <span class="name">{net.ssid || '[Hidden]'}</span>
                                {#if net.connected}
                                    <span class="badge active">Connected</span>
                                {/if}
                            </div>
                            <span class="detail">{net.security || 'Open'} • {net.signal || 0}%</span>
                        </div>
                        <div class="item-actions">
                            <span class="material-icons signal" style="color: {(net.signal || 0) > 50 ? '#06d6a0' : (net.signal || 0) > 25 ? '#ffd166' : '#ef476f'}">
                                {getSignalIcon(net.signal || 0)}
                            </span>
                            {#if !net.connected}
                                <button class="btn-small" onclick={() => openConnect(net.ssid)}>Connect</button>
                            {/if}
                        </div>
                    </div>
                {:else}
                    <div class="empty">No networks found. Scan to refresh.</div>
                {/each}
            </div>
        </section>

        <section class="card">
            <div class="card-header">
                <span class="material-icons">history</span>
                <h2>Saved Connections</h2>
            </div>
            <div class="list">
                {#each savedConnections as conn (conn.name || Math.random())}
                    <div class="item">
                        <div class="item-info">
                            <span class="name">{conn.name || 'Unknown'}</span>
                            <span class="detail">{conn.type || 'wifi'} {conn.device && conn.device !== '--' ? `• ${conn.device}` : ''}</span>
                        </div>
                        <div class="item-actions">
                            {#if conn.device && conn.device !== '--'}
                                <span class="badge active">Connected</span>
                            {/if}
                            <button class="btn-icon delete" onclick={() => deleteConnection(conn.name)}>
                                <span class="material-icons">delete</span>
                            </button>
                        </div>
                    </div>
                {:else}
                    <div class="empty">No saved connections found.</div>
                {/each}
            </div>
        </section>
    </div>
</div>

{#if showConnectModal}
    <div class="modal-overlay" onclick={handleOverlayClick} onkeydown={handleKeydown} role="button" tabindex="-1">
        <div class="modal" role="dialog" aria-modal="true" tabindex="0" onclick={e => e.stopPropagation()}>
            <h3>Connect to {selectedSsid}</h3>
            <div class="input-group">
                <span class="material-icons">lock</span>
                <input type="password" bind:value={password} placeholder="WiFi Password" onkeydown={e => e.key === 'Enter' && connect()} />
            </div>
            <div class="modal-actions">
                <button class="btn-alt" onclick={() => showConnectModal = false}>Cancel</button>
                <button class="btn-primary" onclick={connect}>Connect</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .page { padding: 2.5rem; max-width: 1400px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2.5rem; }
    h1 { margin: 0; font-size: 2rem; font-weight: 700; color: #f6f6f8; }
    .status-pill { display: inline-flex; align-items: center; gap: 0.75rem; background: #1a2233; padding: 0.4rem 0.8rem; border-radius: 9999px; border: 1px solid #243046; margin-top: 0.5rem; }
    .dot { width: 8px; height: 8px; background: #06d6a0; border-radius: 50%; box-shadow: 0 0 8px #06d6a0; }
    .pulse { animation: pulse-animation 2s infinite; }
    @keyframes pulse-animation { 0% { box-shadow: 0 0 0 0px rgba(6, 214, 160, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(6, 214, 160, 0); } 100% { box-shadow: 0 0 0 0px rgba(6, 214, 160, 0); } }
    .status-text { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #06d6a0; letter-spacing: 0.5px; border-right: 1px solid #243046; padding-right: 0.75rem; }
    .ip-list { display: flex; gap: 0.5rem; }
    .ip-tag { font-family: monospace; font-size: 0.8rem; color: #cbd5e1; background: #151c2c; padding: 0.1rem 0.5rem; border-radius: 4px; }
    .ip-tag .iface { color: #2b6cee; font-weight: bold; margin-right: 0.2rem; }
    .ip-tag.disconnected { color: #ef476f; }
    .btn-refresh { display: flex; align-items: center; gap: 0.5rem; background: #2b6cee; color: white; border: none; padding: 0.75rem 1.25rem; border-radius: 0.75rem; cursor: pointer; font-weight: 600; transition: all 0.2s; }
    .btn-refresh:disabled { opacity: 0.5; }
    .spinning { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 2rem; }
    .card { background: #1a2233; border-radius: 1rem; border: 1px solid #243046; overflow: hidden; }
    .card-header { padding: 1.25rem; background: #151c2c; border-bottom: 1px solid #243046; display: flex; align-items: center; gap: 0.75rem; color: #2b6cee; }
    .card-header h2 { margin: 0; font-size: 1rem; color: #f6f6f8; text-transform: uppercase; letter-spacing: 1px; }
    .list { display: flex; flex-direction: column; }
    .item { padding: 1.25rem; border-bottom: 1px solid #243046; display: flex; justify-content: space-between; align-items: center; }
    .item.connected { background: rgba(43, 108, 238, 0.05); border-left: 3px solid #2b6cee; }
    .item:hover { background: #1e293b; }
    .item-info { display: flex; flex-direction: column; gap: 0.25rem; }
    .name-group { display: flex; align-items: center; gap: 0.75rem; }
    .name { font-weight: 600; color: #cbd5e1; }
    .detail { font-size: 0.85rem; color: #64748b; }
    .btn-small { background: rgba(43, 108, 238, 0.1); color: #2b6cee; border: 1px solid #2b6cee; padding: 0.4rem 0.75rem; border-radius: 0.5rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
    .badge { padding: 0.25rem 0.5rem; border-radius: 0.4rem; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
    .badge.active { background: rgba(6, 214, 160, 0.1); color: #06d6a0; }
    .btn-icon.delete { color: #64748b; background: none; border: none; cursor: pointer; padding: 0.4rem; }
    .btn-icon.delete:hover { color: #ef476f; }
    .empty { padding: 2rem; text-align: center; color: #64748b; }
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: #1a2233; padding: 2rem; border-radius: 1rem; border: 1px solid #243046; width: 400px; }
    .modal h3 { margin: 0 0 1.5rem 0; color: #f6f6f8; }
    input { width: 100%; padding: 0.75rem 1rem 0.75rem 2.75rem; background: #151c2c; border: 1px solid #243046; color: #f6f6f8; border-radius: 0.75rem; outline: none; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; }
    .btn-alt { background: none; border: 1px solid #243046; color: #64748b; padding: 0.75rem 1.25rem; border-radius: 0.75rem; cursor: pointer; }
    .btn-primary { background: #2b6cee; border: none; color: white; padding: 0.75rem 1.25rem; border-radius: 0.75rem; cursor: pointer; font-weight: 600; }
</style>
