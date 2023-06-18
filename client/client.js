const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');

const DEFAULT_SERVER_IP = '127.0.0.2';
const DEFAULT_SERVER_PORT = 9999


function postRequest(serverIp, serverPort, path, data) {
    const postData = new URLSearchParams(data).toString();
    const requestOptions = {
        hostname: serverIp,
        port: serverPort,
        path: path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData),
        },
    };

    return new Promise((resolve, reject) => {
        const req = http.request(requestOptions, (res) => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function getUniqueKey(serverIp, serverPort, uniqueId) {
    try {
        const key = await postRequest(serverIp, serverPort, '/', { ask_key: uniqueId });
        return key;
    } catch (error) {
        console.error(`Error requesting unique key: ${error.message}`);
        throw error;
    }
}

async function loginToServer(serverIp, serverPort, key) {
    try {
        const result = await postRequest(serverIp, serverPort, '/', { login: key });
        return result;
    } catch (error) {
        console.error(`Error logging in to server: ${error.message}`);
        throw error;
    }
}

function restartProcess(uniqueId) {
    const args = process.argv.slice(2);
    args.push(uniqueId);
    const child = spawn(process.argv[0], args, { detached: true, stdio: 'ignore' });
    child.unref();
    process.exit();
}
function killServerPid(pid) {
    spawn('kill', [pid]);
}

function findServerPidAndTerminate() {
    return new Promise((resolve, reject) => {
        const childProcesses = spawn('ps', ['ax']);
        const output = [];

        childProcesses.stdout.on('data', (data) => {
            output.push(data);
        });

        childProcesses.on('close', () => {
            const processes = output.join('').split('\n');
            processes.forEach((process) => {
                if (process.includes('node') && process.includes('server.js')) {
                    const pid = process.trim().split(' ')[0];
                    killServerPid(pid);
                    resolve(pid);
                }
            });
            reject(new Error('Server.js process not found.'));
        });
    });
}

async function connectToServer() {
    let serverIp = DEFAULT_SERVER_IP;
    let serverPort = DEFAULT_SERVER_PORT;
    let uniqueId = crypto.randomBytes(64).toString('base64');

    // Check if command line arguments are present and override defaults if so
    if (process.argv.length > 2) {
        const [argServerIp, argServerPort, argUniqueId] = process.argv[2].split(',');
        if (argServerIp) {
            serverIp = argServerIp;
        }
        if (argServerPort) {
            serverPort = parseInt(argServerPort);
        }
        if (argUniqueId) {
            uniqueId = argUniqueId;
        }
    }
    console.log(serverIp, serverPort)
    let retry = false;

    try {
        const key = await getUniqueKey(serverIp, serverPort, uniqueId);
        const result = await loginToServer(serverIp, serverPort, key, uniqueId);
        if (result === uniqueId) {
            console.log(`Got proper unique ID: ${result}`);
            restartProcess(result);
        } else {
            console.log(`Unexpected result: ${result}`);
            console.log('Stopping the server');
            await findServerPidAndTerminate();
        }
    } catch (error) {
        console.error(`Error connecting to server: ${error.message}`);
        retry = true;
    }

    if (retry) {
        await retryConnection(serverIp, serverPort, uniqueId);
    }
}
connectToServer()
async function retryConnection() {
    let delay = 100;
    let retries = 0;
    // Added max retries to test, I know it was not part of the original requirements.
    // const maxRetries = 20;
    
    async function doRetry() {
        console.log(`Retrying connection in ${delay}ms...`);
        try {
            const key = await getUniqueKey();
            const result = await loginToServer(key);
            if (result === uniqueId) {
                console.log(`Got proper unique ID: ${result}`);
                restartProcess(result);
            } else {
                console.log(`Unexpected result: ${result}`);
                console.log('Stopping the server');
                await findServerPidAndTerminate();
            }
        } catch (error) {
            retries++;
            // if (retries >= maxRetries) {
            //     console.error(`Max retries (${maxRetries}) reached. Giving up.`);
            //     await findServerPidAndTerminate();
            //     return;
            // }
            console.error(`Error connecting to server: ${error.message}`);
            delay += 5;
            setTimeout(doRetry, delay);
        }
    }
    await doRetry();
}