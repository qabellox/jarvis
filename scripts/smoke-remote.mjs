// Smoke test: prove the exact path the web app uses works end-to-end.
// Connects to the Core over WebSocket with a token (like lib/remoteBridge.ts),
// asks the agent to use the new file tools, prints the event stream.
const URL = 'ws://127.0.0.1:8767';
const TOKEN = 'test123';

const ws = new WebSocket(URL);
const events = [];
let requestId = 'smoke_1';
let done = false;
const timeout = setTimeout(() => {
    console.error('TIMEOUT — no agent done event in 90s');
    process.exit(1);
}, 90000);

ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'hello', clientType: 'cli', clientId: 'smoke_cli', version: '1.0.0', token: TOKEN }));
};

ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.type === 'welcome') {
        console.log('WELCOME ok, capabilities:', msg.capabilities.length);
        ws.send(JSON.stringify({ type: 'request', requestId, method: 'agent.run', params: { prompt: 'Create the file hello.txt containing "JARVIS global access works" in the workspace, then list the files there.' } }));
        return;
    }
    if (msg.type === 'response') {
        console.log('agent.run ->', JSON.stringify(msg.data));
        return;
    }
    if (msg.type === 'event' && msg.channel === 'agent:event') {
        const ev = msg.payload;
        if (ev.type === 'token') process.stdout.write(ev.data);
        if (ev.type === 'tool_call') console.log('\n[TOOL]', ev.data.name, JSON.stringify(ev.data.args));
        if (ev.type === 'tool_result') console.log('\n[TOOL RESULT]', ev.data.name, 'ok=' + ev.data.ok, '-', ev.data.summary);
        if (ev.type === 'done') { done = true; clearTimeout(timeout); console.log('\nDONE aborted=' + ev.data.aborted); setTimeout(() => process.exit(0), 300); }
        if (ev.type === 'error') { clearTimeout(timeout); console.error('\nAGENT ERROR', JSON.stringify(ev.data)); process.exit(1); }
    }
};

ws.onerror = (e) => { console.error('WS error', e.message); process.exit(1); };
ws.onclose = () => { if (!done) { console.error('WS closed early'); process.exit(1); } };
