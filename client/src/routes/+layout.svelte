<script>
	import favicon from '$lib/assets/favicon.svg';
    import { onMount } from 'svelte';
    import { auth } from '$lib/stores/auth';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import Sidebar from '$lib/components/Sidebar.svelte';
    import { socket } from '$lib/stores/socket';

	let { children } = $props();

    // Use $effect for redirection - cleaner in Svelte 5
    $effect(() => {
        if (!$auth.isAuthenticated && $page.url.pathname !== '/login') {
            goto('/login');
        }
    });

    onMount(() => {
        // Global socket notifications
        const unmountSocket = socket.subscribe(s => {
            if (s) {
                s.on('notification', (notif) => {
                    if (notif && notif.message) {
                        alert(`${notif.type?.toUpperCase() || 'INFO'}: ${notif.message}`);
                    }
                });
            }
        });

        return () => {
            unmountSocket();
        };
    });
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
</svelte:head>

<div class="app-layout">
    {#if $auth.isAuthenticated && $page.url.pathname !== '/login'}
        <Sidebar />
    {/if}
    <main>
        {@render children()}
    </main>
</div>

<style>
    :global(body) {
        margin: 0;
        padding: 0;
        font-family: 'Space Grotesk', sans-serif;
        background: #101622;
        color: #f6f6f8;
    }

    .app-layout {
        display: flex;
        height: 100vh;
        width: 100vw;
    }

    main {
        flex: 1;
        overflow-y: auto;
        position: relative;
    }

    :global(button) {
        font-family: 'Space Grotesk', sans-serif;
    }
</style>
