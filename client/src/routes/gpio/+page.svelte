<script>
    import { onMount, onDestroy } from 'svelte';
    import { socket } from '$lib/stores/socket';

    let pins = $state([]);
    let unsubscribe;

    onMount(() => {
        unsubscribe = socket.subscribe(s => {
            if (s) {
                s.emit('gpio:get_pins');
                s.on('gpio:pins_data', (data) => {
                    pins = Array.isArray(data) ? data : [];
                });
            }
        });
    });

    onDestroy(() => {
        if (unsubscribe) unsubscribe();
        socket.subscribe(s => {
            if (s) s.off('gpio:pins_data');
        })();
    });

    function toggleMode(pinNumber) {
        if (!pinNumber) return;
        socket.subscribe(s => {
            if (s) s.emit('gpio:toggle', pinNumber);
        })();
    }

    function toggleState(pinNumber, currentState) {
        if (!pinNumber) return;
        const newState = currentState === 'HIGH' ? 'LOW' : 'HIGH';
        socket.subscribe(s => {
            if (s) s.emit('gpio:set_state', { pinNumber, state: newState });
        })();
    }
</script>

<div class="page">
    <header>
        <div class="title-group">
            <h1>GPIO Manager</h1>
            <p class="subtitle">Real-time hardware control interface</p>
        </div>
        <div class="status-badge">
            <span class="label">Architecture</span>
            <span class="value">40-Pin Header</span>
        </div>
    </header>

    <div class="grid">
        {#each pins as pin (pin.number)}
            <div class="pin-card" class:high={pin.state === 'HIGH'} class:out={pin.mode === 'OUT'}>
                <div class="pin-num">{pin.number}</div>
                <div class="pin-info">
                    <button class="mode-toggle" onclick={() => toggleMode(pin.number)}>
                        {pin.mode || 'IN'}
                    </button>
                    <div class="state-container">
                        {#if pin.mode === 'OUT'}
                            <button 
                                class="state-btn" 
                                onclick={() => toggleState(pin.number, pin.state)}
                            >
                                {pin.state || 'LOW'}
                            </button>
                        {:else}
                            <span class="state-label">{pin.state || 'LOW'}</span>
                        {/if}
                    </div>
                </div>
            </div>
        {:else}
            <div class="loading">Connecting to GPIO controller...</div>
        {/each}
    </div>

    <div class="legend">
        <div class="legend-item"><span class="box in"></span> Input Mode</div>
        <div class="legend-item"><span class="box out"></span> Output Mode</div>
        <div class="legend-item"><span class="box high"></span> High Signal</div>
    </div>
</div>

<style>
    .page { padding: 2.5rem; max-width: 1400px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2.5rem; }
    h1 { margin: 0; font-size: 2rem; font-weight: 700; color: #f6f6f8; }
    .subtitle { margin: 0.25rem 0 0 0; color: #64748b; }
    .status-badge { background: #1a2233; padding: 0.5rem 1rem; border-radius: 0.75rem; border: 1px solid #243046; display: flex; flex-direction: column; align-items: flex-end; }
    .status-badge .label { font-size: 0.7rem; color: #64748b; text-transform: uppercase; }
    .status-badge .value { font-size: 1.1rem; font-weight: 600; color: #cbd5e1; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 3rem; }
    .pin-card { background: #1a2233; border: 1px solid #243046; border-radius: 1rem; padding: 1.25rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; transition: all 0.2s; }
    .pin-card.out { border-color: #2b6cee55; background: rgba(43, 108, 238, 0.03); }
    .pin-card.high { border-color: #ffd16655; background: rgba(255, 209, 102, 0.05); }
    .pin-num { width: 32px; height: 32px; background: #243046; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 700; color: #94a3b8; }
    .out .pin-num { background: #2b6cee; color: white; }
    .high .pin-num { background: #ffd166; color: #1a2233; }
    .pin-info { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; width: 100%; }
    .mode-toggle { background: #151c2c; border: 1px solid #243046; color: #64748b; padding: 0.25rem 0.75rem; border-radius: 0.5rem; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.2s; }
    .mode-toggle:hover { border-color: #2b6cee; color: #2b6cee; }
    .out .mode-toggle { color: #2b6cee; border-color: #2b6cee33; }
    .state-container { height: 24px; display: flex; align-items: center; }
    .state-label { font-size: 0.9rem; font-weight: 700; color: #475569; }
    .high .state-label { color: #ffd166; }
    .state-btn { background: transparent; border: 1px solid #243046; color: #94a3b8; padding: 0.2rem 0.6rem; border-radius: 0.4rem; font-size: 0.8rem; font-weight: 700; cursor: pointer; }
    .high .state-btn { background: #ffd166; border-color: #ffd166; color: #1a2233; }
    .legend { display: flex; gap: 2rem; background: #151c2c; padding: 1.25rem 2rem; border-radius: 1rem; border: 1px solid #243046; }
    .legend-item { display: flex; align-items: center; gap: 0.75rem; font-size: 0.9rem; color: #64748b; }
    .box { width: 12px; height: 12px; border-radius: 3px; border: 1px solid #243046; }
    .box.in { background: #1a2233; }
    .box.out { background: rgba(43, 108, 238, 0.2); border-color: #2b6cee; }
    .box.high { background: #ffd166; border-color: #ffd166; }
    .loading { grid-column: 1 / -1; text-align: center; padding: 4rem; color: #64748b; }
</style>
