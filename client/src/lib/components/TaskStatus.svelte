<script>
    import { tasks } from '$lib/stores/tasks';
    import { fade, slide } from 'svelte/transition';

    function clearTask(id) {
        tasks.remove(id);
    }
</script>

{#if $tasks.length > 0}
    <div class="task-center" transition:fade>
        <div class="header">
            <span class="material-icons">task</span>
            <span>Active Tasks</span>
        </div>
        <div class="task-list">
            {#each $tasks as task (task.id)}
                <div class="task-item" transition:slide>
                    <div class="task-info">
                        <span class="material-icons icon">
                            {task.status === 'error' ? 'error' : task.status === 'completed' ? 'check_circle' : 'cloud_upload'}
                        </span>
                        <div class="details">
                            <span class="name" title={task.name}>{task.name}</span>
                            <span class="status-text">{task.status === 'active' ? `${task.progress}%` : task.status}</span>
                        </div>
                        {#if task.status !== 'active'}
                            <button class="close-btn" onclick={() => clearTask(task.id)}>
                                <span class="material-icons">close</span>
                            </button>
                        {/if}
                    </div>
                    {#if task.status === 'active'}
                        <div class="progress-bar">
                            <div class="fill" style="width: {task.progress}%"></div>
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    </div>
{/if}

<style>
    .task-center {
        margin: 0.5rem;
        background: #151c2c;
        border: 1px solid #243046;
        border-radius: 0.75rem;
        overflow: hidden;
    }
    .header {
        padding: 0.75rem;
        background: #1a2233;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #64748b;
        border-bottom: 1px solid #243046;
    }
    .header .material-icons { font-size: 1rem; color: #2b6cee; }

    .task-list {
        max-height: 200px;
        overflow-y: auto;
    }

    .task-item {
        padding: 0.75rem;
        border-bottom: 1px solid #243046;
    }
    .task-item:last-child { border-bottom: none; }

    .task-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        position: relative;
    }

    .icon { font-size: 1.25rem; color: #2b6cee; }
    .task-item .details { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .name { font-size: 0.85rem; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .status-text { font-size: 0.7rem; color: #64748b; text-transform: capitalize; }

    .progress-bar {
        height: 3px;
        background: #243046;
        border-radius: 2px;
        margin-top: 0.5rem;
        overflow: hidden;
    }
    .fill {
        height: 100%;
        background: #2b6cee;
        transition: width 0.3s ease;
    }

    .close-btn {
        background: none;
        border: none;
        color: #64748b;
        cursor: pointer;
        padding: 0.25rem;
    }
    .close-btn:hover { color: #f6f6f8; }
    .close-btn .material-icons { font-size: 1rem; }
</style>
