<script>
    import { onMount, onDestroy } from 'svelte';
    import { socket } from '$lib/stores/socket';

    /** @type {any[]} */
    let services = $state([]);
    let filter = $state('');
    let unsubscribe;

    onMount(() => {
        unsubscribe = socket.subscribe(s => {
            if (s) {
                s.emit('services:get');
                s.on('services:data', (data) => {
                    services = Array.isArray(data) ? data : [];
                });
                s.on('services:refresh', () => {
                    s.emit('services:get');
                });
            }
        });
    });

    onDestroy(() => {
        if (unsubscribe) unsubscribe();
        socket.subscribe(s => {
            if (s) {
                s.off('services:data');
                s.off('services:refresh');
            }
        })();
    });

    function controlService(service, action) {
        if (!service) return;
        socket.subscribe(s => {
            if (s) s.emit('services:control', { service, action });
        })();
    }

    const filteredServices = $derived((services || []).filter(s =>
        (s.name || '').toLowerCase().includes((filter || '').toLowerCase()) ||
        (s.description || '').toLowerCase().includes((filter || '').toLowerCase())
    ));
</script>

<div class="page">
    <header>
        <div class="title-group">
            <h1>System Services</h1>
            <p class="subtitle">{services.length} total services, {services.filter(s => s.active === 'active').length} running</p>
        </div>
        <div class="actions">
            <div class="search-box">
                <span class="material-icons">search</span>
                <input type="text" bind:value={filter} placeholder="Search services..." />
            </div>
        </div>
    </header>

    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th>Service Name</th>
                    <th>Status</th>
                    <th>Description</th>
                    <th class="text-right">Actions</th>
                </tr>
            </thead>
            <tbody>
                {#each filteredServices as svc (svc.name)}
                    <tr>
                        <td class="name-cell">
                            <span class="material-icons svc-icon">settings</span>
                            <span class="name">{svc.name}</span>
                        </td>
                        <td>
                            <span class="status-badge" class:active={svc.active === 'active'}>
                                <span class="dot"></span>
                                {svc.active || 'unknown'}
                            </span>
                        </td>
                        <td class="desc">{svc.description || 'No description available'}</td>
                        <td class="actions-cell">
                            {#if svc.active === 'active'}
                                <button class="btn-stop" onclick={() => controlService(svc.name, 'stop')}>
                                    <span class="material-icons">stop</span>
                                    Stop
                                </button>
                            {:else}
                                <button class="btn-start" onclick={() => controlService(svc.name, 'start')}>
                                    <span class="material-icons">play_arrow</span>
                                    Start
                                </button>
                            {/if}
                            <button class="btn-restart" onclick={() => controlService(svc.name, 'restart')}>
                                <span class="material-icons">refresh</span>
                                Restart
                            </button>
                        </td>
                    </tr>
                {:else}
                    <tr>
                        <td colspan="4" class="empty">No services found</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</div>

<style>
    .page { padding: 2.5rem; max-width: 1400px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2.5rem; }
    h1 { margin: 0; font-size: 2rem; font-weight: 700; color: #f6f6f8; }
    .subtitle { margin: 0.25rem 0 0 0; color: #64748b; font-size: 0.95rem; }
    .search-box { position: relative; display: flex; align-items: center; }
    .search-box .material-icons { position: absolute; left: 1rem; color: #64748b; font-size: 1.25rem; }
    input { background: #1a2233; border: 1px solid #243046; color: #f6f6f8; padding: 0.75rem 1rem 0.75rem 2.75rem; border-radius: 0.75rem; width: 320px; font-size: 0.95rem; transition: all 0.2s; outline: none; }
    input:focus { border-color: #2b6cee; background: #1e293b; }
    .table-container { background: #1a2233; border-radius: 1rem; overflow: hidden; border: 1px solid #243046; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th, td { padding: 1.25rem; border-bottom: 1px solid #243046; }
    th { background: #151c2c; color: #64748b; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
    .name-cell { display: flex; align-items: center; gap: 0.75rem; }
    .svc-icon { color: #2b6cee; font-size: 1.25rem; }
    .name { font-weight: 600; color: #cbd5e1; }
    .desc { color: #64748b; font-size: 0.9rem; }
    .status-badge { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; background: #1e293b; color: #94a3b8; text-transform: uppercase; }
    .status-badge .dot { width: 6px; height: 6px; border-radius: 50%; background: #94a3b8; }
    .status-badge.active { background: rgba(6, 214, 160, 0.1); color: #06d6a0; }
    .status-badge.active .dot { background: #06d6a0; box-shadow: 0 0 8px #06d6a0; }
    .actions-cell { display: flex; gap: 0.75rem; justify-content: flex-end; }
    button { display: inline-flex; align-items: center; gap: 0.4rem; background: #243046; color: #cbd5e1; border: 1px solid transparent; padding: 0.5rem 0.75rem; border-radius: 0.5rem; cursor: pointer; font-size: 0.85rem; transition: all 0.2s; font-weight: 500; }
    button:hover { background: #1e293b; color: #f6f6f8; }
    .btn-start { color: #06d6a0; background: rgba(6, 214, 160, 0.1); }
    .btn-start:hover { background: #06d6a0; color: #101622; }
    .btn-stop { color: #ef476f; background: rgba(239, 71, 111, 0.1); }
    .btn-stop:hover { background: #ef476f; color: #f6f6f8; }
    .empty { text-align: center; color: #64748b; padding: 3rem; font-style: italic; }
</style>
