<script>
  import { onMount, onDestroy } from 'svelte';
  import { Terminal } from 'xterm';
  import { FitAddon } from 'xterm-addon-fit';
  import { socket } from '$lib/stores/socket';
  import 'xterm/css/xterm.css';

  let terminalContainer;
  let term;
  let fitAddon;
  let unsubscribe;

  onMount(() => {
    term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", monospace',
      fontSize: 14,
      theme: {
        background: '#0a0f1a',
        foreground: '#cbd5e1',
        cursor: '#2b6cee',
        selectionBackground: 'rgba(43, 108, 238, 0.3)',
        black: '#1e293b',
        red: '#ef476f',
        green: '#06d6a0',
        yellow: '#ffd166',
        blue: '#2b6cee',
        magenta: '#ae81ff',
        cyan: '#3a86ff',
        white: '#f6f6f8'
      }
    });

    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalContainer);
    fitAddon.fit();

    unsubscribe = socket.subscribe(s => {
        if (s) {
            if (s.connected) onConnect(s);
            s.on('connect', () => onConnect(s));
            s.on('terminal:output', (data) => term.write(data));
            s.on('disconnect', () => term.write('\r\n*** Disconnected from backend ***\r\n'));
        }
    });

    function onConnect(s) {
      term.write('\r\n*** Connected to backend ***\r\n');
      s.emit('terminal:start', { cols: term.cols, rows: term.rows });
    }

    term.onData((data) => {
      socket.subscribe(s => { if (s) s.emit('terminal:input', data); })();
    });

    const handleResize = () => {
        fitAddon.fit();
        socket.subscribe(s => {
            if (s && s.connected) s.emit('terminal:resize', { cols: term.cols, rows: term.rows });
        })();
    };
    window.addEventListener('resize', handleResize);
    term.focus();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (unsubscribe) unsubscribe();
      socket.subscribe(s => {
          if (s) {
              s.off('terminal:output');
              s.off('connect');
              s.off('disconnect');
          }
      })();
      if (term) term.dispose();
    };
  });
</script>

<div class="terminal-wrapper" bind:this={terminalContainer}></div>

<style>
  .terminal-wrapper { width: 100%; height: 100%; background: #0a0f1a; padding: 1rem; box-sizing: border-box; overflow: hidden; }
</style>
