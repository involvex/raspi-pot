<script>
    import { onMount, onDestroy } from 'svelte';
    import { socket } from '$lib/stores/socket';

    let scriptPath = $state('');
    let output = $state('');
    let isRunning = $state(false);
    let unsubscribe;
    let terminalEnd;

    onMount(() => {
        unsubscribe = socket.subscribe(s => {
            if (s) {
                s.on('scripts:output', (data) => {
                    output += String(data || '');
                    if (terminalEnd) {
                        try {
                            terminalEnd.scrollIntoView({ behavior: 'smooth' });
                        } catch (e) { /* ignore */ }
                    }
                });
                s.on('scripts:finished', () => {
                    isRunning = false;
                });
            }
        });
    });

    onDestroy(() => {
        if (unsubscribe) unsubscribe();
        socket.subscribe(s => {
            if (s) {
                s.off('scripts:output');
                s.off('scripts:finished');
            }
        })();
    });

    function runScript() {
        if (!scriptPath || isRunning) return;
        socket.subscribe(s => {
            if (s) {
                output = '';
                isRunning = true;
                s.emit('scripts:run', scriptPath);
            }
        })();
    }

    function clearOutput() { output = ''; }

    const quickScripts = [
        { name: 'Update System', cmd: 'sudo apt update && sudo apt upgrade -y' },
        { name: 'Cleanup Logs', cmd: 'sudo journalctl --vacuum-time=1d' },
        { name: 'Check Temperature', cmd: 'vcgencmd measure_temp' },
        { name: 'List USB Devices', cmd: 'lsusb' }
    ];
</script>

<div class="page">
    <header>
        <div class="title-group">
            <h1>Script Runner</h1>
            <p class="subtitle">Execute custom shell commands and scripts</p>
        </div>
    </header>

    <div class="layout">
        <div class="controls">
            <section class="card">
                <div class="card-header">
                    <span class="material-icons">terminal</span>
                    <h2>Run Command</h2>
                </div>
                <div class="card-body">
                    <div class="input-group">
                        <input 
                            type="text" 
                            bind:value={scriptPath} 
                            placeholder="Enter command (e.g. ls -la)" 
                            onkeydown={(e) => e.key === 'Enter' && runScript()}
                        />
                        <button class="btn-primary" onclick={runScript} disabled={isRunning}>
                            {#if isRunning}
                                <span class="material-icons spinning">sync</span>
                                Running...
                            {:else}
                                <span class="material-icons">play_arrow</span>
                                Run
                            {/if}
                        </button>
                    </div>
                </div>
            </section>

            <section class="card">
                <div class="card-header">
                    <span class="material-icons">bolt</span>
                    <h2>Quick Actions</h2>
                </div>
                <div class="card-body quick-grid">
                    {#each quickScripts as script}
                        <button class="quick-btn" onclick={() => { scriptPath = script.cmd; runScript(); }}>
                            <span class="script-name">{script.name}</span>
                            <code class="script-cmd">{script.cmd}</code>
                        </button>
                    {/each}
                </div>
            </section>
        </div>

        <div class="output-area">
            <div class="output-header">
                <span class="material-icons">output</span>
                <span>Console Output</span>
                <button class="btn-icon" onclick={clearOutput} title="Clear Console">
                    <span class="material-icons">delete_sweep</span>
                </button>
            </div>
            <div class="console">
                <pre>{output}</pre>
                <div bind:this={terminalEnd}></div>
                {#if !output && !isRunning}
                    <div class="empty">Waiting for command...</div>
                {/if}
            </div>
        </div>
    </div>
</div>

<style>
    .page { padding: 2.5rem; max-width: 1400px; margin: 0 auto; height: 100vh; display: flex; flex-direction: column; box-sizing: border-box; }
    header { margin-bottom: 2rem; }
    h1 { margin: 0; font-size: 2rem; font-weight: 700; color: #f6f6f8; }
    .subtitle { margin: 0.25rem 0 0 0; color: #64748b; font-size: 0.95rem; }
    .layout { display: grid; grid-template-columns: 400px 1fr; gap: 2rem; flex: 1; min-height: 0; }
    .controls { display: flex; flex-direction: column; gap: 2rem; }
    .card { background: #1a2233; border-radius: 1rem; border: 1px solid #243046; overflow: hidden; }
    .card-header { padding: 1.25rem; background: #151c2c; border-bottom: 1px solid #243046; display: flex; align-items: center; gap: 0.75rem; color: #2b6cee; }
    .card-header h2 { margin: 0; font-size: 1rem; color: #f6f6f8; text-transform: uppercase; letter-spacing: 1px; }
    .card-body { padding: 1.5rem; }
    .input-group { display: flex; flex-direction: column; gap: 1rem; }
    input { background: #151c2c; border: 1px solid #243046; color: #f6f6f8; padding: 0.75rem 1rem; border-radius: 0.75rem; outline: none; font-family: monospace; }
    .btn-primary { background: #2b6cee; color: white; border: none; padding: 0.75rem; border-radius: 0.75rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
    .quick-grid { display: grid; gap: 0.75rem; }
    .quick-btn { background: #151c2c; border: 1px solid #243046; color: #cbd5e1; padding: 0.75rem; border-radius: 0.75rem; text-align: left; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 0.25rem; }
    .quick-btn:hover { border-color: #2b6cee; background: #1e293b; }
    .script-name { font-weight: 600; font-size: 0.9rem; }
    .script-cmd { font-size: 0.75rem; color: #64748b; font-family: monospace; }
    .output-area { background: #0a0f1a; border-radius: 1rem; border: 1px solid #243046; display: flex; flex-direction: column; overflow: hidden; }
    .output-header { padding: 1rem; background: #151c2c; border-bottom: 1px solid #243046; display: flex; align-items: center; gap: 0.75rem; color: #cbd5e1; font-weight: 600; font-size: 0.9rem; }
    .console { flex: 1; padding: 1.5rem; overflow-y: auto; font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; color: #cbd5e1; line-height: 1.5; white-space: pre-wrap; }
    pre { margin: 0; }
    .empty { height: 100%; display: flex; align-items: center; justify-content: center; color: #475569; font-style: italic; }
    .spinning { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .btn-icon { background: none; border: none; color: #64748b; cursor: pointer; padding: 0.4rem; }
</style>
