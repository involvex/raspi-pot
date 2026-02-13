<script>
    import { onMount, onDestroy } from 'svelte';
    import { socket } from '$lib/stores/socket';
    import { auth } from '$lib/stores/auth';
    import { tasks } from '$lib/stores/tasks';

    let currentPath = $state('');
    let items = $state([]);
    let unsubscribe;

    let editingFile = $state(null);
    let editContent = $state('');
    let isEditing = $state(false);

    onMount(() => {
        unsubscribe = socket.subscribe(s => {
            if (s) {
                s.emit('files:list', currentPath);

                s.on('files:data', (data) => {
                    currentPath = data?.path || '';
                    items = Array.isArray(data?.items) ? data.items : [];
                });

                s.on('files:content', (data) => {
                    editingFile = data?.path;
                    editContent = data?.content || '';
                    isEditing = true;
                });

                s.on('files:refresh', () => {
                    s.emit('files:list', currentPath);
                });
            }
        });
    });

    onDestroy(() => {
        if (unsubscribe) unsubscribe();
        socket.subscribe(s => {
            if (s) {
                s.off('files:data');
                s.off('files:content');
                s.off('files:refresh');
            }
        })();
    });

    function navigate(path) {
        socket.subscribe(s => {
            if (s) s.emit('files:list', path);
        })();
    }

    function goUp() {
        const parts = (currentPath || '').split('/').filter(Boolean);
        parts.pop();
        const parent = '/' + parts.join('/');
        navigate(parent);
    }

    function handleFileClick(item) {
        if (!item) return;
        if (item.isDirectory) {
            navigate(item.path);
        } else {
            const textExtensions = ['.txt', '.js', '.py', '.sh', '.json', '.conf', '.env', '.css', '.html', '.svelte', '.md'];
            const ext = item.name.slice(item.name.lastIndexOf('.')).toLowerCase();
            if (textExtensions.includes(ext) || !item.name.includes('.')) {
                socket.subscribe(s => {
                    if (s) s.emit('files:read', item.path);
                })();
            } else {
                alert('Preview not available for this file type.');
            }
        }
    }

    function downloadFile(path) {
        if (!path) return;
        auth.subscribe($auth => {
            const token = $auth?.token || '';
            const url = `/api/files/download?path=${encodeURIComponent(path)}&token=${token}`;
            window.open(url, '_blank');
        })();
    }

    function uploadFile(event) {
        const file = event.target.files ? event.target.files[0] : null;
        if (!file) return;

        const taskId = Math.random().toString(36).substr(2, 9);
        tasks.add(taskId, file.name);

        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/files/upload?path=${encodeURIComponent(currentPath)}`, true);
        
        auth.subscribe($auth => {
            const token = $auth?.token || '';
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        })();

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                tasks.updateProgress(taskId, percent);
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                tasks.complete(taskId);
                navigate(currentPath);
                setTimeout(() => tasks.remove(taskId), 3000);
            } else {
                tasks.error(taskId, 'Upload failed');
            }
        };

        xhr.onerror = () => tasks.error(taskId, 'Network error');
        xhr.send(formData);
    }

    function saveFile() {
        if (editingFile) {
            socket.subscribe(s => {
                if (s) s.emit('files:write', { path: editingFile, content: editContent });
            })();
        }
    }

    function deleteItem(item) {
        if (!item) return;
        if (confirm(`Delete ${item.name}?`)) {
            socket.subscribe(s => {
                if (s) s.emit('files:delete', item.path);
            })();
        }
    }

    function formatSize(bytes) {
        if (!bytes) return '';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
</script>

<div class="page">
    <header>
        <div class="title-group">
            <h1>File Explorer</h1>
            <div class="breadcrumb">
                <button class="btn-icon" onclick={goUp}><span class="material-icons">arrow_upward</span></button>
                <span class="path">{currentPath}</span>
            </div>
        </div>
        <div class="actions">
            <label class="btn-primary upload-btn">
                <span class="material-icons">upload</span>
                Upload
                <input type="file" onchange={uploadFile} hidden />
            </label>
        </div>
    </header>

    {#if isEditing}
        <div class="editor-view">
            <div class="editor-header">
                <span class="material-icons">description</span>
                <span class="filename">{editingFile?.split('/').pop() || ''}</span>
                <div class="editor-actions">
                    <button class="btn-alt" onclick={() => isEditing = false}>Close</button>
                    <button class="btn-primary" onclick={saveFile}>Save Changes</button>
                </div>
            </div>
            <textarea bind:value={editContent} spellcheck="false"></textarea>
        </div>
    {:else}
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Size</th>
                        <th class="text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each items as item (item.path)}
                        <tr class="file-item">
                            <td class="name-cell" onclick={() => handleFileClick(item)}>
                                <span class="material-icons icon" class:dir={item.isDirectory}>
                                    {item.isDirectory ? 'folder' : 'insert_drive_file'}
                                </span>
                                <span class="name">{item.name}</span>
                            </td>
                            <td class="size">{formatSize(item.size)}</td>
                            <td class="actions-cell">
                                {#if !item.isDirectory}
                                    <button class="btn-icon" onclick={() => downloadFile(item.path)} title="Download">
                                        <span class="material-icons">download</span>
                                    </button>
                                {/if}
                                <button class="btn-icon delete" onclick={() => deleteItem(item)} title="Delete">
                                    <span class="material-icons">delete</span>
                                </button>
                            </td>
                        </tr>
                    {:else}
                        <tr>
                            <td colspan="3" class="empty">Loading directory...</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>

<style>
    .page { padding: 2.5rem; max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; height: 100vh; box-sizing: border-box; }
    header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; }
    h1 { margin: 0; font-size: 2rem; font-weight: 700; color: #f6f6f8; }
    .breadcrumb { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; background: #1a2233; padding: 0.4rem 0.8rem; border-radius: 0.75rem; border: 1px solid #243046; }
    .path { font-family: monospace; font-size: 0.9rem; color: #64748b; }
    .table-container { background: #1a2233; border-radius: 1rem; overflow-y: auto; border: 1px solid #243046; flex: 1; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th, td { padding: 1rem 1.25rem; border-bottom: 1px solid #243046; }
    th { background: #151c2c; color: #64748b; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
    .file-item { cursor: pointer; transition: background 0.2s; }
    .file-item:hover { background: #1e293b; }
    .name-cell { display: flex; align-items: center; gap: 0.75rem; }
    .icon { color: #64748b; font-size: 1.25rem; }
    .icon.dir { color: #2b6cee; }
    .name { color: #cbd5e1; font-weight: 500; }
    .size { color: #475569; font-size: 0.85rem; }
    .actions-cell { display: flex; justify-content: flex-end; gap: 0.5rem; }
    .btn-icon { background: none; border: none; color: #64748b; cursor: pointer; padding: 0.4rem; border-radius: 0.4rem; }
    .btn-icon:hover { background: #243046; color: #f6f6f8; }
    .upload-btn { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
    .btn-primary { background: #2b6cee; color: white; border: none; padding: 0.75rem 1.25rem; border-radius: 0.75rem; font-weight: 600; cursor: pointer; }
    .btn-alt { background: none; border: 1px solid #243046; color: #64748b; padding: 0.75rem 1.25rem; border-radius: 0.75rem; cursor: pointer; }
    .editor-view { flex: 1; display: flex; flex-direction: column; background: #0a0f1a; border-radius: 1rem; border: 1px solid #243046; overflow: hidden; }
    .editor-header { padding: 1rem; background: #151c2c; border-bottom: 1px solid #243046; display: flex; align-items: center; gap: 0.75rem; }
    .filename { flex: 1; color: #f6f6f8; font-weight: 600; }
    .editor-actions { display: flex; gap: 1rem; }
    textarea { flex: 1; background: transparent; border: none; color: #cbd5e1; padding: 1.5rem; font-family: 'JetBrains Mono', monospace; font-size: 1rem; line-height: 1.5; outline: none; resize: none; }
    .empty { text-align: center; color: #64748b; padding: 2rem; }
</style>
