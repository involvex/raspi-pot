<script>
    import { onMount, onDestroy } from 'svelte';
    import { socket } from '$lib/stores/socket';
    import TelemetryCard from '$lib/components/TelemetryCard.svelte';

    let stats = { 
        cpu: 0, 
        mem: 0, 
        temp: 0, 
        uptime: 0,
        mem_total: '8.0 GB',
        mem_used: '0.0 GB',
        disk_used: '0.0 GB',
        disk_total: '0.0 GB',
        net_down: '0.0 MB/s',
        net_up: '0.0 MB/s',
        ips: []
    };
    let unsubscribe;
    let updateTimeout = null;

    // Debounce updates for Pi 2B performance
    function debouncedUpdate(newStats) {
        if (updateTimeout) clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => {
            stats = { ...stats, ...newStats };
        }, 100); // 100ms debounce
    }

    onMount(() => {
        unsubscribe = socket.subscribe($socket => {
            if ($socket) {
                $socket.on('telemetry:stats', debouncedUpdate);
            }
        });
    });

    onDestroy(() => {
        if (unsubscribe) unsubscribe();
        if ($socket) $socket.off('telemetry:stats');
        if (updateTimeout) clearTimeout(updateTimeout);
    });

    function formatUptime(seconds) {
        if (!seconds) return '0d 00:00:00';
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor((seconds % (3600 * 24)) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${d}d ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
</script>

<div class="dashboard">
    <header>
        <div class="welcome">
            <h1>System Overview</h1>
            <div class="status-pill">
                <span class="dot pulse"></span>
                <span class="status-text">Online</span>
                <div class="ip-list">
                    {#each stats.ips as item}
                        <span class="ip-tag">
                            <span class="iface">{item.iface}:</span>
                            {item.ip}
                        </span>
                    {/each}
                    {#if stats.ips.length === 0}
                        <span class="ip-tag disconnected">Disconnected</span>
                    {/if}
                </div>
            </div>
        </div>
        <div class="quick-stats">
            <div class="stat-item">
                <span class="label">Uptime</span>
                <span class="value">{formatUptime(stats.uptime)}</span>
            </div>
            <div class="stat-item">
                <span class="label">Load Avg</span>
                <span class="value">0.45 | 0.60 | 0.55</span>
            </div>
        </div>
    </header>

    <div class="grid">
        <TelemetryCard 
            title="CPU Usage" 
            value={stats.cpu} 
            unit="%" 
            icon="developer_board"
            color="#2b6cee"
            details={[
                {label: 'ARM Cortex-A72', value: '@ 1.5GHz'},
                {label: 'Load', value: 'Moderate'}
            ]}
        />
        <TelemetryCard 
            title="RAM Usage" 
            value={stats.mem} 
            unit="%" 
            icon="memory"
            color="#06d6a0"
            status={stats.mem > 80 ? 'Warning' : 'Healthy'}
            statusColor={stats.mem > 80 ? '#ef476f' : '#06d6a0'}
            details={[
                {label: 'Total', value: stats.mem_total},
                {label: 'Used', value: stats.mem_used}
            ]}
        />
        <TelemetryCard 
            title="Disk Space" 
            value={Math.round((parseFloat(stats.disk_used) / parseFloat(stats.disk_total)) * 100) || 0} 
            unit="%" 
            icon="sd_storage"
            color="#ffd166"
            status="Warning"
            statusColor="#ffd166"
            details={[
                {label: 'Used', value: stats.disk_used},
                {label: 'Total', value: stats.disk_total}
            ]}
        />
        <TelemetryCard 
            title="SoC Temp" 
            value={stats.temp} 
            unit="°C" 
            icon="thermostat"
            color="#ef476f"
            status={stats.temp > 60 ? 'High' : 'Optimal'}
            statusColor={stats.temp > 60 ? '#ef476f' : '#06d6a0'}
            details={[
                {label: 'Fahrenheit', value: `${Math.round(stats.temp * 1.8 + 32)}°F`},
                {label: 'Limit', value: '85°C'}
            ]}
        />
        <TelemetryCard 
            title="Network" 
            value={stats.net_down} 
            unit="" 
            icon="lan"
            color="#3a86ff"
            details={[
                {label: 'Download', value: stats.net_down},
                {label: 'Upload', value: stats.net_up}
            ]}
        />
    </div>
</div>

<style>
    .dashboard {
        padding: 2.5rem;
        max-width: 1400px;
        margin: 0 auto;
    }

    header {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-bottom: 2.5rem;
    }

    h1 {
        margin: 0;
        font-size: 2rem;
        font-weight: 700;
        color: #f6f6f8;
    }

    .subtitle {
        margin: 0.25rem 0 0 0;
        color: #64748b;
        font-size: 0.95rem;
    }

    .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.75rem;
        background: #1a2233;
        padding: 0.5rem 1rem;
        border-radius: 9999px;
        border: 1px solid #243046;
        margin-top: 1rem;
    }

    .dot {
        width: 8px;
        height: 8px;
        background: #06d6a0;
        border-radius: 50%;
        box-shadow: 0 0 8px #06d6a0;
    }

    .pulse {
        animation: pulse-animation 2s infinite;
    }

    @keyframes pulse-animation {
        0% { opacity: 1; }
        50% { opacity: 0.7; }
        100% { opacity: 1; }
    }

    .status-text {
        font-size: 0.85rem;
        font-weight: 700;
        text-transform: uppercase;
        color: #06d6a0;
        letter-spacing: 0.5px;
        border-right: 1px solid #243046;
        padding-right: 0.75rem;
    }

    .ip-list {
        display: flex;
        gap: 0.5rem;
    }

    .ip-tag {
        font-family: monospace;
        font-size: 0.9rem;
        color: #cbd5e1;
        background: #151c2c;
        padding: 0.1rem 0.6rem;
        border-radius: 4px;
    }

    .ip-tag .iface {
        color: #2b6cee;
        font-weight: bold;
        margin-right: 0.2rem;
    }

    .ip-tag.disconnected {
        color: #ef476f;
    }

    .quick-stats {
        display: flex;
        gap: 2rem;
    }

    .stat-item {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
    }

    .stat-item .label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #64748b;
    }

    .stat-item .value {
        font-size: 1.1rem;
        font-weight: 600;
        color: #cbd5e1;
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.5rem;
    }
</style>
