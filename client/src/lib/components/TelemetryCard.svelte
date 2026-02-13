<script>
    /**
     * @typedef {Object} Detail
     * @property {string} label
     * @property {string|number} value
     */

    /**
     * @typedef {Object} Props
     * @property {string} title
     * @property {string|number} value
     * @property {string} [unit]
     * @property {string} [color]
     * @property {string} [icon]
     * @property {string} [status]
     * @property {string} [statusColor]
     * @property {Detail[]} [details]
     */

    /** @type {Props} */
    let {
        title,
        value,
        unit = '',
        color = '#2b6cee',
        icon = 'analytics',
        status = 'Optimal',
        statusColor = '#06d6a0',
        details = []
    } = $props();
</script>

<div class="card">
    <div class="card-header">
        <div class="title-group">
            <span class="material-icons" style="color: {color}">{icon}</span>
            <h3>{title}</h3>
        </div>
        <div class="status" style="background: {statusColor}22; color: {statusColor}">
            {status}
        </div>
    </div>

    <div class="main-value">
        <span class="value">{value}</span>
        <span class="unit">{unit}</span>
    </div>

    {#if details && details.length > 0}
        <div class="details">
            {#each details as detail}
                <div class="detail-item">
                    <span class="label">{detail.label}</span>
                    <span class="val">{detail.value}</span>
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .card {
        background: #1a2233;
        padding: 1.25rem;
        border-radius: 1rem;
        border: 1px solid #243046;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        /* Optimized: Remove heavy transitions for Pi 2B */
        transform: translateZ(0); /* Hardware acceleration hint */
    }
    .card:hover {
        border-color: #2b6cee55;
    }
    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
    }
    .title-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .title-group .material-icons {
        font-size: 1.25rem;
    }
    h3 {
        margin: 0;
        color: #94a3b8;
        font-size: 0.875rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .status {
        font-size: 0.7rem;
        padding: 0.2rem 0.5rem;
        border-radius: 0.5rem;
        font-weight: 600;
        text-transform: uppercase;
    }
    .main-value {
        display: flex;
        align-items: baseline;
        gap: 0.25rem;
    }
    .value {
        font-size: 2.25rem;
        font-weight: 700;
        color: #f6f6f8;
    }
    .unit {
        font-size: 1rem;
        color: #64748b;
    }
    .details {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding-top: 1rem;
        border-top: 1px solid #243046;
    }
    .detail-item {
        display: flex;
        justify-content: space-between;
        font-size: 0.8rem;
    }
    .label { color: #64748b; }
    .val { color: #cbd5e1; font-weight: 500; }
</style>
