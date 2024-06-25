const server = require('http').createServer();
const PORT = 9000;
const io = require('socket.io')(server, {
    cors: {
        origin: ["http://localhost:3000"],
        methods: ["GET", "POST"],
        allowedHeaders: ["ludoAuth"]
    }
});

const SocketEvents = require('./events/socket-events');
io.on('connection', (client) => {
    console.log('client connection...', client.id);
    client.emit(SocketEvents.PING_PONG, { msg: 'SOCKET:MSG connection done' });
    console.log('client connection... ========= ping done  ', io.sockets.sockets.size);

    client.on(SocketEvents.PING_PONG, (rData) => {
        client.emit(SocketEvents.PING_PONG, { msg: 'SOCKET:MSG connection done' });
    });

    client.on(SocketEvents.TRADE_INIT, (rData) => {
        client.emit(SocketEvents.STATUS_LOGS, { msg: 'SOCKET:MSG calling Master Data' });
        makeLamdaCalls(client);
    });

    client.on('disconnect', () => {
        console.log('client disconnect...', client.id);
        client.emit(SocketEvents.PING_PONG, { msg: 'SOCKET:MSG disconnected' });
    });
    client.on('error', (err) => {
        console.error('received error from client:', client.id);
        console.error(err);
    });

});

server.listen(PORT, (err) => {
    if (err) throw err;
    console.log('listening on port: ', PORT);
});



const makeLamdaCalls = async (client) => {
    const masterURI = 'https://pdzsl5xw2kwfmvauo5g77wok3q0yffpl.lambda-url.us-east-2.on.aws/';
    const authURI = 'https://mt4.mtapi.io/Connect?user=44712225&password=tfkp48&host=18.209.126.198&port=443';
    const slaveURI = 'https://mt4.mtapi.io/OrderSend?';
    const options = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    };
    const masterData = await fetch(masterURI, options)
        .then(async (resp) => {
            return await resp.json();
        })
        .catch((e) => {
            console.log('get masterData failed  ', e);
            client.emit(SocketEvents.STATUS_LOGS, { msg: 'SOCKET:MSG Error in getting master data, ALL STOP HERE' });
        });
    console.log('masterData  ', masterData);
    if (masterData) {
        client.emit(SocketEvents.STATUS_LOGS, { msg: 'SOCKET:MSG Getting master data success' });
        client.emit(SocketEvents.STATUS_LOGS, { msg: 'SOCKET:MSG Next do the login' });
        const authToken = await fetch(authURI, options)
            .then(async (resp) => {
                return await resp.text();
            })
            .catch((e) => {
                console.log('get authToken failed  ', e);
                client.emit(SocketEvents.STATUS_LOGS, { msg: 'SOCKET:MSG Error in getting auth Token, ALL STOP HERE' });
            });
        console.log('authToken>>  ', authToken);
        if (authToken) {
            client.emit(SocketEvents.STATUS_LOGS, { msg: 'SOCKET:MSG LOGIN success' });
            client.emit(SocketEvents.STATUS_LOGS, { msg: 'SOCKET:MSG Next get SLAVE DATA' });

            const { symbol, operation, volume, takeprofit, comment } = masterData;
            const queryStr = `id=${authToken}&symbol=${symbol}&operation=${operation}&volume=${volume}&takeprofit=${takeprofit}&comment=${comment}`;
            const uri = `${slaveURI}${queryStr}`;
            const slaveData = await fetch(uri, options)
                .then(async (resp) => {
                    return await resp.json();
                })
                .catch((e) => {
                    console.log('get authToken failed  ', e);
                    client.emit(SocketEvents.STATUS_LOGS, { msg: 'SOCKET:MSG Error in getting SLAVE DATA, ALL STOP HERE' });
                });
            console.log('slaveData>>  ', slaveData);
            if (slaveData) {
                client.emit(SocketEvents.STATUS_LOGS, { msg: 'SOCKET:MSG FINAL STEP COMPLETE, data sent to client' });
                client.emit(SocketEvents.TRADE_COMPLETE, slaveData);
            }

        }
    }
}