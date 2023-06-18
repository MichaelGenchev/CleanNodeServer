const http = require('http');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const crypto = require('crypto');

const SERVER_IP = '127.0.0.2';
const SERVER_PORT = 9999;

let uniqueIdMap = new Map();
// CHANGE THIS IF YOU WANT THE SERVER TO FAIL
let shouldFail = false;

function handleRequest(req, res) {
    if (req.method !== 'POST') {
        res.statusCode = 400;
        res.end('wrong_query');
        return;
    }

    let body = '';
    req.on('data', (chunk) => {
        body += chunk.toString();
    });

    req.on('end', () => {
        const params = new URLSearchParams(body);
        const askKey = params.get('ask_key');
        let loginKey = params.get('login');

        if (askKey) {
            const key = crypto.randomBytes(64).toString('base64');
            uniqueIdMap.set(key, askKey);
            res.end(key);
        } else if (loginKey) {
            convKey = loginKey.replace(/ /g, '+');
            const key = uniqueIdMap.get(convKey);
            if (!key) {
                res.statusCode = 401;
                res.end('wrong_key');
            } else {
                console.log(uniqueIdMap)
                if (shouldFail) {
                    res.end('testFAILING')
                } else {
                    res.end(key);
                }
            }
        } else {
            res.statusCode = 400;
            res.end('wrong_query');
        }
    });
}

if (isMainThread) {

    const worker = new Worker(__filename, {
        workerData: { ip: SERVER_IP, port: SERVER_PORT }
    });

    worker.on('message', (message) => {
        if (message.type === 'uniqueIdMap') {
            uniqueIdMap = message.map;
        }
    });

    console.log(`Server running at http://${SERVER_IP}:${SERVER_PORT}/`);
} else {
    const server = http.createServer(handleRequest);

    const { ip, port } = workerData;
    server.listen(port, ip, () => {
        console.log(`Worker thread started HTTP server at http://${ip}:${port}/`);
        parentPort.postMessage({ type: 'uniqueIdMap', map: uniqueIdMap });
    });
}