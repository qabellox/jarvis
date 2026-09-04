const WS = require('ws');
const URL = process.argv[2];
const TOKEN = process.argv[3];

const w = new WS(URL);
const req = (id, method, params) => w.send(JSON.stringify({ type: 'request', requestId: id, method, params }));
let fired = false;

w.on('open', () =>
    w.send(JSON.stringify({ type: 'hello', clientType: 'test', clientId: 't4', version: '1.0.0', token: TOKEN }))
);

w.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.type === 'welcome') {
        req('r1', 'conversation.list', { limit: 100 });
    } else if (m.type === 'response') {
        if (m.requestId === 'r1') {
            console.log('BEFORE count', (m.data || []).length);
            req('r2', 'agent.run', { prompt: 'Persistence check: reply with the exact string REMEMBER-ME-MARKER-99' });
        } else if (m.requestId === 'r2') {
            console.log('AGENT RUN sessionId', m.data && m.data.sessionId);
        } else if (m.requestId === 'r3' && !fired) {
            fired = true;
            const list = m.data || [];
            console.log('AFTER count', list.length);
            const last2 = list.slice(-2).map((x) => ({ role: x.role, content: (x.content || '').slice(0, 80) }));
            console.log('LAST 2', JSON.stringify(last2, null, 1));
            w.close();
            process.exit(0);
        }
    }
});

setTimeout(() => {
    if (!fired) req('r3', 'conversation.list', { limit: 100 });
}, 12000);
setTimeout(() => {
    if (!fired) {
        console.log('TIMEOUT');
        process.exit(1);
    }
}, 20000);
