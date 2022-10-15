const https = require('https');
const WebSocket = require('ws');

const Helpers = {
    Encryption: require('./helpers/cipher'),
    PacketEngineer: require('./helpers/parser'),
}

const _https_get = https.get;
https.get = (...args) => {
    if (!args[0].host.includes('.hiss.io')) return _https_get(...args);

    if (args[0]?.headers) {
        args[0].headers = {
            Host: args[0].host,
            Connection: undefined,
            Pragma: undefined,
            'Cache-Control': undefined,
            'User-Agent': undefined,
            Upgrade: undefined,
            Origin: undefined,
            'Sec-WebSocket-Version': undefined,
            'Accept-Encoding': undefined,
            'Accept-Language': undefined,
            'Sec-WebSocket-Key': undefined,
            'Sec-WebSocket-Extensions': undefined,
            ...args[0].headers,
        };
    }
    
    return _https_get(...args);
};

class DiepSocket extends WebSocket {
    constructor(url) {
        super(url, {
            origin: 'https://diep.io',
            headers: {
                Pragma: 'no-cache',
                'Cache-Control': 'no-cache',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
            },
        });

        const { Parser, Generator } = Helpers.PacketEngineer;
        const { Cipher } = Helpers.Encryption;

        this.parser = new Parser();
        this.generator = new Generator();
        this.cipher = new Cipher();
        this.binaryType = 'nodebuffer';
    
        this.__send = WebSocket.prototype.send;

        this.onmessage = function(e) {
            let { data } = e;
            if (data[0] == 0x01) return this.emit('decryptedMessage', new Uint8Array(data));
            
            this.cipher.set(data);
            return this.emit('decryptedMessage', this.cipher.decrypt());
        }
    }

    send(data) {
        if (data[0] == 0x00) return this.__send.call(this, data);

        this.cipher.set(data);
        data = this.cipher.encrypt();
        return this.__send.call(this, data);
    }
};

const WebSocketManager = class {
    connect(url, party) {
        return new Promise((resolve, reject) => {
            setTimeout(function() {
                reject('Promise timed out after 5 seconds.');
                try { socket.terminate(); } catch (er) { setTimeout(function() { socket.terminate() }, 1000); }
            }, 1e4);

            const socket = new DiepSocket(url);

            socket.on('open', function() {
                console.log(`Connection established (${socket.url}).`);

                this.generator.set({
                    header: 'INIT',
                    build: '059af6c3b62d24618e396ab482b73d2351056b06',
                    password: '',
                    party: '',
                    token: 'player.eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSJ9.CM6X_9GUMBDO543W9y8aEgoQB7RC8spbSmqfx1DKSJaktSIWKhQKEgoQFsXgCMphS0G2-YB9D1FthA.WmTpVCQrA7lo3wWIWpL7Gr8a8KTm1KomkHMSPXnlifvzrZ53yLriJFBlvwEIVYiE0i28MLjGXkT9Rmf_ipcHBA',
                });

                this.send(this.generator.generate());
            });

            socket.on('decryptedMessage', function(data) {
                this.parser.set(data);
                const packet = this.parser.parse();

                console.log(packet);

                if (!packet || !packet.type) {
                    reject('Types casted invalid. Parsing failing... Closing connection.');
                    socket.terminate();
                    return;
                }

                switch (packet.type) {
                    case 'INVALID_BUILD': {
                        reject('Mismatch in build. Seek help from developers.');
                        socket.terminate();
                        break;
                    }
                    case 'COMPRESSION': {
                        switch (packet.data.result.type) {
                            case 'JS_CHALLENGE': {
                                let { result, id } = packet.data.result.data;

                                this.generator.set({
                                    header: 'JS_CHALLENGE_REPLY',
                                    id,
                                    result
                                });
                                this.send(this.generator.generate());
                                break;
                            }
                            case 'UPDATE': {
                                if (party) return;
                                if (JSON.stringify(packet.data.result.data.scoreboard) == '{}') return;
                                resolve(packet.data.result.data.scoreboard);
                                socket.terminate();
                                break;
                            }
                        }
                        break;
                    }
                    case 'PARTY': {
                        const code = packet.data.party;
                        if (party) {
                            resolve(code);
                            socket.terminate();
                        }
                        break;
                    }
                    case 'UPDATE': {
                        if (party) return;
                        if (JSON.stringify(packet.data.scoreboard) == '{}') return;
                        resolve(packet.data.scoreboard);
                        socket.terminate();
                        break;
                    }
                    case 'POW_CHALLENGE': {
                        const { result } = packet.data;

                        this.generator.set({
                            header: 'POW_CHALLENGE_REPLY',
                            result,
                        });
                        this.send(this.generator.generate());
                        break;
                    }
                }
            });
        });
    }
}

module.exports = { WebSocketManager };