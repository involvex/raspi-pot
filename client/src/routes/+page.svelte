<script>
    import { onMount, onDestroy } from 'svelte';
    import { socket } from '$lib/stores/socket';
    import TelemetryCard from '$lib/components/TelemetryCard.svelte';

    // Using individual states for maximum stability on Pi 2B
    let cpu = $state(0);
    let mem = $state(0);
    let temp = $state(0);
    let uptime = $state(0);
    let mem_total = $state('0.0 GB');
    let mem_used = $state('0.0 GB');
    let disk_total = $state('0.0 GB');
    let disk_used = $state('0.0 GB');
    let net_down = $state('0.0 MB/s');
    let net_up = $state('0.0 MB/s');
    let ips = $state([]);

    let unsubscribe;

    function handleStats(data) {
        if (!data) return;
        // Direct updates are faster and safer in Svelte 5 for primitive types
        if (typeof data.cpu === 'number') cpu = data.cpu;
        if (typeof data.mem === 'number') mem = data.mem;
        if (typeof data.temp === 'number') temp = data.temp;
        if (typeof data.uptime === 'number') uptime = data.uptime;
        if (data.mem_total) mem_total = String(data.mem_total);
        if (data.mem_used) mem_used = String(data.mem_used);
        if (data.disk_total) disk_total = String(data.disk_total);
        if (data.disk_used) disk_used = String(data.disk_used);
        if (data.net_down) net_down = String(data.net_down);
        if (data.net_up) net_up = String(data.net_up);
        if (Array.isArray(data.ips)) ips = data.ips;
    }

    onMount(() => {
        // Use auto-subscription for reactive context safety
        unsubscribe = socket.subscribe(s => {
            if (s) {
                s.on('telemetry:stats', handleStats);
            }
        });
    });

    onDestroy(() => {
        if (unsubscribe) unsubscribe();
        // Get current socket value to unregister listener
        socket.subscribe(s => {
            if (s) s.off('telemetry:stats', handleStats);
        })();
    });

    function formatUptime(s) {
        if (!s) return '0d 00:00:00';
        const d = Math.floor(s / (3600 * 24));
        const h = Math.floor((s % (3600 * 24)) / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        return `${d}d ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }

    // Defensive derived values
    const tempStatus = $derived((temp || 0) > 70 ? 'High' : (temp || 0) > 60 ? 'Warning' : 'Optimal');
    const tempColor = $derived((temp || 0) > 70 ? '#ef476f' : (temp || 0) > 60 ? '#ffd166' : '#06d6a0');
    
    const ramStatus = $derived((mem || 0) > 85 ? 'Critical' : 'Optimal');
    const ramColor = $derived((mem || 0) > 85 ? '#ef476f' : '#06d6a0');
    
    const diskPercent = $derived(() => {
        const used = parseFloat(disk_used) || 0;
        const total = parseFloat(disk_total) || 1; // Avoid div by zero
        return Math.round((used / total) * 100);
    });
</script>

<div class="dashboard">
    <header>
        <div class="welcome">
            <h1>System Overview</h1>
            <div class="status-pill">
                <span class="dot pulse"></span>
                <span class="status-text">Online</span>
                <div class="ip-list">
                    {#if ips && ips.length > 0}
                        {#each ips as item (item.iface)}
                            <span class="ip-tag">
                                <span class="iface">{item.iface}:</span>
                                {item.ip}
                            </span>
                        {/each}
                    {:else}
                        <span class="ip-tag disconnected">Connecting...</span>
                    {/if}
                </div>
            </div>
        </div>
        <div class="quick-stats">
            <div class="stat-item">
                <span class="label">Uptime</span>
                <span class="value">{formatUptime(uptime)}</span>
            </div>
            <div class="stat-item">
                <span class="label">Architecture</span>
                <span class="value">ARMv7 (2B)</span>
            </div>
        </div>
    </header>

    <div class="grid">
        <TelemetryCard 
            title="CPU Usage" 
            value={cpu} 
            unit="%" 
            icon="developer_board"
            color="#2b6cee"
            details={[
                {label: 'Model', value: 'BCM2836'},
                {label: 'Cores', value: '4x @ 900MHz'}
            ]}
        />
        <TelemetryCard 
            title="RAM Usage" 
            value={mem} 
            unit="%" 
            icon="memory"
            color={ramColor}
            status={ramStatus}
            statusColor={ramColor}
            details={[
                {label: 'Total', value: mem_total},
                {label: 'Used', value: mem_used}
            ]}
        />
        <TelemetryCard 
            title="Disk Space" 
            value={diskPercent()} 
            unit="%" 
            icon="sd_storage"
            color="#ffd166"
            status="Healthy"
            statusColor="#06d6a0"
            details={[
                {label: 'Used', value: disk_used},
                {label: 'Total', value: disk_total}
            ]}
        />
        <TelemetryCard 
            title="SoC Temp" 
            value={temp} 
            unit="°C" 
            icon="thermostat"
            color={tempColor}
            status={tempStatus}
            statusColor={tempColor}
            details={[
                {label: 'Fahrenheit', value: `${Math.round(temp * 1.8 + 32)}°F`},
                {label: 'Limit', value: '85°C'}
            ]}
        />
        <TelemetryCard 
            title="Network" 
            value={net_down} 
            unit="" 
            icon="lan"
            color="#3a86ff"
            details={[
                {label: 'Download', value: net_down},
                {label: 'Upload', value: net_up}
            ]}
        />
    </div>
</div>

<style>
    .dashboard { padding: 2.5rem; max-width: 1400px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2.5rem; }
    h1 { margin: 0; font-size: 2rem; font-weight: 700; color: #f6f6f8; }
    .status-pill { display: inline-flex; align-items: center; gap: 0.75rem; background: #1a2233; padding: 0.5rem 1rem; border-radius: 9999px; border: 1px solid #243046; margin-top: 1rem; }
    .dot { width: 8px; height: 8px; background: #06d6a0; border-radius: 50%; box-shadow: 0 0 8px #06d6a0; }
    .pulse { animation: pulse-animation 2s infinite; }
    @keyframes pulse-animation { 0% { box-shadow: 0 0 0 0px rgba(6, 214, 160, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(6, 214, 160, 0); } 100% { box-shadow: 0 0 0 0px rgba(6, 214, 160, 0); } }
    .status-text { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; color: #06d6a0; letter-spacing: 0.5px; border-right: 1px solid #243046; padding-right: 0.75rem; }
    .ip-list { display: flex; gap: 0.5rem; }
    .ip-tag { font-family: monospace; font-size: 0.9rem; color: #cbd5e1; background: #151c2c; padding: 0.1rem 0.6rem; border-radius: 4px; }
    .ip-tag .iface { color: #2b6cee; font-weight: bold; margin-right: 0.2rem; }
    .ip-tag.disconnected { color: #ef476f; }
    .quick-stats { display: flex; gap: 2rem; }
    .stat-item { display: flex; flex-direction: column; align-items: flex-end; }
    .stat-item .label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
    .stat-item .value { font-size: 1.1rem; font-weight: 600; color: #cbd5e1; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
</style>
