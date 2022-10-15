(async function() {
    const { Parser, Generator, Bīsmuth, TankTable } = require('./parser');
    const { Client, MessageEmbed } = require('discord.js');
    const https = require('https');
    const ms = require('pretty-ms');
    const similarity = require('string-similarity')
    
    const fetch = require('node-fetch');
    const { XMLHttpRequest } = require('xmlhttprequest');
    const WebSocket = require('ws');
    
    const REGIONS = ["lnd-sfo", "lnd-atl", "lnd-fra", "lnd-syd"];
    const MODES = ["ffa", "survival", "teams", "4teams", "dom", "tag", "maze", "sandbox"];
        
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

    let BUILD;
    
    const _r = await fetch('https://diep.io/');
    const r = await _r.text();
    BUILD = r.match(/[0-9a-f]{40}/)[0];

    Array.prototype.remove = function(element) {
        return this.splice(this.indexOf(element), 1);
    };
    
    class SharpClient extends Client {
        constructor(opts) {
            super(opts);
            this.options = opts;
            this.owner = '765239557666111509';
    
            this.servers = { isReady: false, servers: {}, counter: 0, uncached: [], parties: { counter: 0, }, };
            this._servers = { uncached: [] };

            this.messages = new Map();

            this.validModes = {
                'ffa': 'ffa',
                'teams': 'teams',
                '2teams': 'teams',
                '2tdm': 'teams',
                '4teams': '4teams',
                '4tdm': '4teams',
                'maze': 'maze',
            };
            this.validRegions = {
                'sfo': 'lnd-sfo',
                'la': 'lnd-sfo',
                'miami': 'lnd-atl',
                'nyc': 'lnd-atl',
                'atl': 'lnd-atl',
                'atlanta': 'lnd-atl',
                'eu': 'lnd-fra',
                'fra': 'lnd-fra',
                'frankfurt': 'lnd-fra',
                'syd': 'lnd-syd',
                'sydney': 'lnd-syd',
            };
            this.COLOR_MAP = {
                'BLUE': '💙',
                'RED': '❤️',
                'GREEN': '💚',
                'PURPLE': '💜',
                'WHITE': '🤍',
                '0': 'BLUE',
                '1': 'RED',
                '2': 'PURPLE',
                '3': 'GREEN'
            };
    
            MODES.forEach((mode) => {
                if (['tag', 'survival', 'dom', 'sandbox'].includes(mode)) return;
                this.servers.servers[mode] = {};
                this._servers[mode] = {};
                REGIONS.forEach((region) => {
                    this.servers.servers[mode][region] = { lobbies: {} };
                    this._servers[mode][region] = { lobbies: {} };
                })
            });
    
            this.findServers();
            setInterval(async () => {
                console.log('recaching');
                MODES.forEach((mode) => {
                    if (['tag', 'survival', 'dom', 'sandbox'].includes(mode)) return;
                    this._servers[mode] = {};
                    REGIONS.forEach((region) => {
                        this._servers[mode][region] = { lobbies: {} };
                    });
                });

                this.servers.uncached = [];
                this._servers.uncached = [];

                console.log(client.servers.servers['ffa']['lnd-sfo']);

                const response = await fetch('https://diepstats.binary-person.dev/api/currentServers');
                const s = await response.json();
                this.serverList = s.servers;

               this.findServers();
            }, 3e5);
        }
    
        async findServers() {           
            const response = await fetch('https://diepstats.binary-person.dev/api/currentServers');
            const s = await response.json();
            let servers = this.serverList = s.servers;
            let ServersPassable = true;

            const Connect = async () => {
                let passable = true;

                if (client.servers.counter >= Object.entries(servers).length) {
                    ServersPassable = false;
                    client.servers.servers = JSON.parse(JSON.stringify(this._servers));
                    client.servers.uncached = JSON.parse(JSON.stringify(this._servers.uncached));
                    client.servers.isReady = true;
                    client.servers.counter = 0;
                    return console.log('All scoreboards were received!');
                }

                if (!ServersPassable) return;

                const { gamemode, id, partylink, region } = Object.values(servers)[client.servers.counter];
                if (!['ffa', 'teams', '4teams', 'maze'].includes(gamemode)) {
                    passable = false;
                    client.servers.counter++;
                    console.log('No scoreboard for this mode.');
                    Connect();
                };

                const url = `wss://${id}-80.lobby.${region}.hiss.io/`;

                if (!passable) return;

                const setScoreboard = (data) => {
                    this._servers[gamemode][region].lobbies[data.url] = data;
                };
                const setUncached = data => {
                    this._servers.uncached.push(data);
                };
    
                let socket = new WebSocket(url, {
                    origin: 'https://diep.io',
                    rejectUnauthorized: false,
                    headers: {
                        Pragma: 'no-cache',
                        'Cache-Control': 'no-cache',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
                    },
                });
                socket.binaryType = 'arraybuffer';

                socket.parser = new Parser();
                socket.generator = new Generator();
                socket.Bīsmuth = new Bīsmuth();

                socket.packetCount = 0;
                socket.stopParsing = false; 

                socket.on('open', function() {
                    console.log(`Socket opened. URL: ${url}`);
                    
                    this.generator.set({
                        header: 'INIT',
                        build: BUILD,
                        password: '',
                        party: '',
                        token: 'player.eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSJ9.CM6X_9GUMBDO543W9y8aEgoQB7RC8spbSmqfx1DKSJaktSIWKhQKEgoQFsXgCMphS0G2-YB9D1FthA.WmTpVCQrA7lo3wWIWpL7Gr8a8KTm1KomkHMSPXnlifvzrZ53yLriJFBlvwEIVYiE0i28MLjGXkT9Rmf_ipcHBA',
                    });
                    const packet = this.generator.generate();
                    
                    socket.send(packet);
                });

                if (!passable) return;

                socket.on('message', function(data) {
                    if (socket?.stopParsing) return;

                    socket.packetCount++;
                    if (socket.packetCount >= 25) {
                        setUncached(partylink);
                        console.log('Unable to cache: ' + partylink);
                        if (socket) socket.packetCount = 0;
                        socket = null;
                        this?.terminate();
                        Connect();
                    }

                    data = new Uint8Array(data);

                    this.Bīsmuth.set(data);
                    const packet = this.Bīsmuth.Unshuffle();

                    if (![0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 14].includes(packet[0])) return console.log('Invalid packet.');

                    this.parser.set(packet);
                    data = this.parser.parse();

                    if (!data) {
                        setUncached(partylink);
                        console.log('Unable to cache: ' + partylink);
                        socket.packetCount = 0;
                        socket = null;
                        this.terminate();
                        Connect();   
                        return;
                    }

                    switch (data.type) {
                        case 'COMPRESSION': {
                            let { type } = data.data.result;
                            switch (type) {
                                case 'JS_CHALLENGE': {
                                    let { result, id } = data.data.result.data;

                                    result = parseInt(result);    

                                    this.generator.set({
                                        header: 'JS_CHALLENGE_REPLY',
                                        id,
                                        result,
                                    });
                                    let u8 = this.generator.generate();

                                    this.Bīsmuth.set(u8);
                                    u8 = this.Bīsmuth.Shuffle();
                                    
                                    this.send(u8);
                                    break;
                                }
                                case 'UPDATE': {
                                    if (socket) socket.stopParsing = true;
                                    const { scoreboard } = data.data.result.data;
                                    if (JSON.stringify(scoreboard) == '{}' && socket) return socket.stopParsing = false;

                                    setScoreboard({
                                        url,
                                        partylink,
                                        scoreboard,
                                        gamemode,
                                        region,
                                    });

                                    this.terminate(4006);
                                }
                            }
                            break;
                        }
                        case 'POW_CHALLENGE': {
                            const { result } = data.data;

                            this.generator.set({
                                header: 'POW_CHALLENGE_REPLY',
                                result,
                            });
                            let u8 = this.generator.generate();

                            this.Bīsmuth.set(u8);
                            u8 = this.Bīsmuth.Shuffle();

                            this.send(u8);
                            break;
                        }
                        case 'UPDATE': {
                            if (socket) socket.stopParsing = true;
                            const { scoreboard } = data.data;
                            if (JSON.stringify(scoreboard) == '{}' && socket) return socket.stopParsing = false;

                            setScoreboard({
                                wss: url,
                                partylink,
                                scoreboard,
                                gamemode, 
                                region,
                            });

                            this.terminate(4006);
                            break;
                        }
                    }
                });

                socket.on('error', console.error);
                socket.on('close', function(code) {
                    client.servers.counter++;
                    console.log(`${url} socket has closed ${code == 1006 ? 'gracefully': 'unexpectedly'}.`);
                    Connect();
                });
            };

            Connect();
        }

        findParties(server, partyCount, link, message, embed) {      
            client.servers.parties.counter++;

            if (client.servers.parties.counter >= 500) {
                embed.setDescription('500+ attempts were made, yet not all servers could be cached.');
                client.servers.parties[link].forEach(function(party, index) {
                    embed.addField(`${index + 1}.`, `https://${link}00${party}`);
                });

                message.channel.send({ embeds: [embed] });
                client.servers.parties.counter = 0;
                return;
            }

            const socket = new WebSocket(server, {
                origin: 'https://diep.io',
                rejectUnauthorized: false,
                headers: {
                    Pragma: 'no-cache',
                    'Cache-Control': 'no-cache',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
                },
            });
            socket.binaryType = 'arraybuffer';

            socket.parser = new Parser();
            socket.generator = new Generator();
            socket.Bīsmuth = new Bīsmuth();

            socket.on('open', function() {
                console.log(`Socket opened. URL: ${server}`);
                socket.packetCount = 0;
                this.generator.set({
                    header: 'INIT',
                    build: BUILD,
                    password: '',
                    party: '',
                    token: 'player.eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSJ9.CM6X_9GUMBDO543W9y8aEgoQB7RC8spbSmqfx1DKSJaktSIWKhQKEgoQFsXgCMphS0G2-YB9D1FthA.WmTpVCQrA7lo3wWIWpL7Gr8a8KTm1KomkHMSPXnlifvzrZ53yLriJFBlvwEIVYiE0i28MLjGXkT9Rmf_ipcHBA',
                });
                const packet = this.generator.generate();
                
                socket.send(packet);
            });

            socket.packetCount = 0;
            socket.stopParsing = false;

            const timeout = setTimeout(function() {
                console.log('Socket did not get closed. Forcefully aborting...');
                socket.close(4007);
            }, 60000);

            socket.on('message', function(data) {
                if (socket.stopParsing) return;

                socket.packetCount++;
                if (socket.packetCount >= 25) {
                    socket.close(4006, 'PARSER_ERR');
                    return;
                }

                data = new Uint8Array(data);
                this.Bīsmuth.set(data);
                const packet = this.Bīsmuth.Unshuffle();
                if (![0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 14].includes(packet[0])) {
                    console.log('Invalid packet.');
                    socket.stopParsing = true;
                }

                this.parser.set(packet);
                data = this.parser.parse();

                if (!data) return;

                switch (data.type) {
                    case 'COMPRESSION': {
                        let { type } = data.data.result;
                        switch (type) {
                            case 'JS_CHALLENGE': {
                                let { result, id } = data.data.result.data;

                                result = parseInt(result);    

                                this.generator.set({
                                    header: 'JS_CHALLENGE_REPLY',
                                    id,
                                    result,
                                });
                                let u8 = this.generator.generate();

                                this.Bīsmuth.set(u8);
                                u8 = this.Bīsmuth.Shuffle();
                                
                                this.send(u8);
                                break;
                            }
                        }
                        break;
                    }
                    case 'POW_CHALLENGE': {
                        const { result } = data.data;

                        this.generator.set({
                            header: 'POW_CHALLENGE_REPLY',
                            result,
                        });
                        let u8 = this.generator.generate();

                        this.Bīsmuth.set(u8);
                        u8 = this.Bīsmuth.Shuffle();

                        this.send(u8);
                        break;
                    }
                    case 'PARTY': {
                        const { party } = data.data;
                        
                        if (!client.servers.parties[link].includes(party)) {
                            console.log(`New party found: ${party}`);
                            client.servers.parties[link].push(party);

                            if (client.servers.parties[link].length == partyCount) {
                                console.log('Found all parties!');
                                this.close(4005);
                            } else {
                                this.close(4007);
                            }
                        } else {
                            console.log('Old party received: ' + party);
                            this.close(4007);
                        }
                    }
                }
            });
            
            socket.on('close', function(code) {
                console.log(code);
                clearTimeout(timeout);

                switch (code) {
                    case 4005: { // FOUND_ALL_PARTIES
                        client.servers.parties[link].sort(function(a, b) {
                            return parseInt(b.charAt(0), 16) - parseInt(a.charAt(0), 16);
                        });

                        client.servers.parties[link].forEach(function(party, index) {
                            embed.addField(`${client.COLOR_MAP[client.COLOR_MAP[index]]} ${client.COLOR_MAP[index]}`, `https://${link}00${party}`);
                        });
                        message.channel.send(`<@${message.author.id}>`);
                        message.channel.send({ embeds: [embed] });
                        client.servers.parties.counter = 0;
                        break; 
                    } 
                    case 4006: {
                        embed.setDescription('Could not parse incoming packets from this server...');
                        message.channel.send({ embeds: [embed] });
                        break;
                    }
                    case 4007: {
                        client.findParties(server, partyCount, link, message, embed);
                        break;
                    }
                }
            });
        };
    
        XMLRequest(method, url, callback, data = null, headers = []) {
            const xhr = new XMLHttpRequest();
            xhr.open(method, url);
            xhr.onerror = function(error) {
              callback(0, error);
            };
            xhr.onload = function() {
              callback(1, this.responseText, this);
            };
            for(let i = 0; i < headers.length; i++) {
              xhr.setRequestHeader(headers[i][0], headers[i][1]);
            }
            xhr.send(data);
        }
    }
    
    const client = new SharpClient({
        intents: [32767],
    });
    
    client.once('ready', async function() {
        console.log('Ready!');
    });

    client.on('messageReactionAdd', function(reaction, user) {
        if (user.id == client.user.id
        || (reaction.emoji.name != '➡️' && reaction.emoji.name != '⬅️')
        || !client.messages.has(reaction.message.id)) return;

        let { data, currentPage } = client.messages.get(reaction.message.id);

        if (currentPage == 0 && reaction.emoji.name == '⬅️'
        || currentPage + 1 == data.length && reaction.emoji.name == '➡️'
        || data.length < 1) return;

        if (reaction.emoji.name == '➡️')
            currentPage++;
        else
            currentPage--;

        reaction.message.reactions.cache.forEach(function(reaction) { 
            reaction.remove();
        });

        const embed = new MessageEmbed();

        const { title, fields } = data[currentPage];
        embed.setTitle(title);
        fields.forEach(function({ name, value }) {
            embed.addField(name, value);
        });

        reaction.message.edit({ embeds: [embed] })
        .then(async message => {
            if (currentPage >= 1) {
                await message.react('⬅️');
                client.messages.set(message.id, {
                    data,
                    currentPage,
                });
            }  

            if (currentPage + 1 < data.length) {
                await message.react('➡️');
                client.messages.set(message.id, {
                    data,
                    currentPage,
                });
            } 
        });
    });
    
    client.on('messageCreate', async function(message) {
        if (message.content.includes('go get')) return message.channel.send('No. Just No. Stop. Please. STOP. THIS. TORMENT. also if ur abc praise spike and abc 🙏');
        if (!message.content.startsWith('!') || message.author.bot) return;
        const args = message.content.split(' '),
        cmd = args.shift().replace('!', '');
        
        if (cmd == 'leaders') {
            if (!client.servers.isReady) return message.channel.send(`Bot has not finished caching servers... Please be patient. Servers cached: \`${client.servers.counter}\`.`);
            if (client.servers.uncached.length) message.channel.send(`⚠️[WARNING]⚠️: ${client.servers.uncached.length} servers were unable to be cached properly.`);
            const servers = JSON.parse(JSON.stringify(client.servers.servers));

            const gamemodes = args.indexOf('-g');
            const region = args.indexOf('-r');
            const tank = args.indexOf('-t');
            const score_min = args.indexOf('-s');

            let filters = {
                gamemodes: ['ffa', 'teams', '4teams', 'maze'],
                regions: ['lnd-sfo', 'lnd-atl', 'lnd-fra', 'lnd-syd'],
            }

            let minimum = 3.5e5;
            let _modes = filters.gamemodes;
            let _regions = filters.regions;
            let _tank = [];

            let passable = true;

            if (score_min != -1) {
                const string = args[score_min + 1];
                let zeros = 0;

                if (string.endsWith('k')) zeros = 3;
                if (string.endsWith('m')) zeros = 6;

                minimum = parseInt(string) * parseInt(`1${'0'.repeat(zeros)}`);
            }

            if (gamemodes != -1) {
                _modes = message.content.split("-g")[1].split("-")[0].split(" ") || message.content.split("-g")[1].split(" ");
                _modes = _modes.map(mode => client.validModes[mode] || '');
            }
            if (region != -1) {
                _regions = message.content.split("-r")[1].split("-")[0].split(" ") || message.content.split("-r")[1].split(" ");
                _regions = _regions.map(region => client.validRegions[region] || '');
            }
            /*if (tank != -1) {
                _tank = message.content.split("-t")[1].split("-")[0].split(" ").filter(function(s) { s != '' }) || message.content.split("-t")[1].split(" ").filter(function(s) { s != '' });
                _tank.forEach(function(tank) {
                    tank = similarity.findBestMatch(tank, TankTable).bestMatch;
                    _tank.push(tank);
                    message.channel.send(`Filtering tanks by best match: \`${_tank}\`.`);
                });
            }*/

            filters = {
                gamemodes: _modes,
                regions: _regions,
            }
            // if (_tank.length) filters.tank = _tank;

            if (!passable) return;
            delete servers.uncached;

            const embed = new MessageEmbed();
            const scores = [];

            Object.entries(servers).forEach(function([gamemode, info]) {
                Object.values(info).forEach(function({ lobbies }) {
                    Object.entries(lobbies).forEach(function([id, lobby]) {
                        const { partylink, scoreboard, gamemode, region } = lobby;

                        for (let i = 0; i < 10; i++) {
                            if (!scoreboard[i.toString()]) return;

                            if (scoreboard[i.toString()].score < minimum 
                            || filters.gamemodes.indexOf(lobby.gamemode) == -1 
                            || filters.regions.indexOf(lobby.region) == -1
                            /*|| (filters.tank && !filters.tank.includes(scoreboard[i.toString()].tank))*/) return;
                    
                            scores.push({
                                partylink,
                                info: scoreboard[i],
                                gamemode, 
                                region
                            });
                        }
                    });
                });
            });

            scores.sort(function(obj1, obj2) {
                return obj2.info.score - obj1.info.score;
            });

            if (!scores.length) { 
                embed.setDescription('No leaders were found.');
                message.channel.send({ embeds: [embed] });
                return;
            }
            
            function scoreFormat(score) {
                if (score >= 1e6) return (score/1e6).toFixed(1) + "m";
                else if (score >= 1e3) return (score/1e3).toFixed(1) + "k";
                else return score + "";
            }

            const data = [];
            let pageCount = Math.ceil(scores.length / 25);

            for (let page = 0; page < pageCount; page++) {
                data[page] = {
                    title: `Current Leaders (${page + 1}/${pageCount})`,
                    fields: [],
                };

                for (let i = page * 25; i < page * 25 + 25; i++) {
                    let scoreboard = scores[i];
                    if (!scoreboard) break;

                    const { partylink, info, gamemode, region } = scoreboard;

                    data[page].fields.push({
                        name: `${i+1}. ${client.COLOR_MAP[info.color]} ${scoreFormat(parseInt(info.score))} ${info.tank} | **${info.name.replaceAll('_', '').replaceAll('*', '').replaceAll('\`', '').replaceAll('~', '') || 'unnamed'}**`,
                        value: `${gamemode} ${region} https://${partylink}`,
                    });
                }
            }

            const { title, fields } = data[0];
            embed.setTitle(title);
            fields.forEach(function({ name, value }) {
                embed.addField(name, value);
            });

            message.channel.send({ embeds: [embed] })
            .then(async message => {
                if (data.length > 1) {
                    await message.react('➡️');
                    client.messages.set(message.id, {
                        data,
                        currentPage: 0,
                        executor: message.author.id,
                    });
                }
            });
        }

        else if (cmd == 'find') {
            if (!client.servers.isReady) return message.channel.send(`Bot has not finished caching servers... Please be patient. Servers cached: \`${client.servers.counter}\`.`);
            if (client.servers.uncached.length) message.channel.send(`⚠️[WARNING]⚠️: ${client.servers.uncached.length} servers were unable to be cached properly.`);
            const servers = JSON.parse(JSON.stringify(client.servers.servers));
            
            const name = args.join(' ') || '';

            delete servers.uncached;
    
            function scoreFormat(score) {
                if (score >= 1e6) return (score/1e6).toFixed(1) + "m";
                else if (score >= 1e3) return (score/1e3).toFixed(1) + "k";
                else return score + "";
            }

            const embed = new MessageEmbed();
            const _data = [];

            Object.entries(servers).forEach(function([gamemode, info]) {
                Object.values(info).forEach(function({ lobbies }) {
                    Object.entries(lobbies).forEach(function([id, lobby]) {
                        const { partylink, scoreboard, gamemode, region } = lobby;

                        for (let i = 0; i < 10; i++) {
                            if (!scoreboard[i.toString()]) return;

                            if (scoreboard[i.toString()].name.includes(name)) {
                                _data.push({
                                    partylink,
                                    info: scoreboard[i],
                                    gamemode, 
                                    region
                                });
                            }
                        }
                    });
                });
            });

            _data.sort(function(obj1, obj2) {
                return obj2.info.score - obj1.info.score;
            });

            if (!_data.length) { 
                embed.setDescription('No leaders were found.');
                message.channel.send({ embeds: [embed] });
                return;
            }

            const data = [];
            let pageCount = Math.ceil(_data.length / 25);

            for (let page = 0; page < pageCount; page++) {
                data[page] = {
                    title: `Current Leaders (${page + 1}/${pageCount})`,
                    fields: [],
                };

                for (let i = page * 25; i < page * 25 + 25; i++) {
                    let entry = _data[i];
                    if (!entry) break;
                    let { partylink, info, gamemode, region } = entry;
                    if ([partylink, info, gamemode, region].includes(undefined) || [partylink, info, gamemode, region].includes(null)) return;

                    data[page].fields.push({
                        name: `${i+1}. ${client.COLOR_MAP[info.color]} ${scoreFormat(parseInt(info.score))} ${info.tank} | **${info.name.replaceAll('_', '').replaceAll('*', '').replaceAll('\`', '').replaceAll('~', '') || 'unnamed'}**`,
                        value: `${gamemode} ${region} https://${partylink}`,
                    });
                }
            }

            const { title, fields } = data[0];
            embed.setTitle(title);
            fields.forEach(function({ name, value }) {
                embed.addField(name, value);
            });

            message.channel.send({ embeds: [embed] })
            .then(async message => {
                if (data.length > 1) {
                    await message.react('➡️');
                    client.messages.set(message.id, {
                        data,
                        currentPage: 0,
                        executor: message.author.id,
                    });
                }
            });
        }

        else if (cmd == 'scoreboard') {
            const { isReady, uncached } = client.servers;
            if (!isReady) return message.channel.send(`Bot has not finished caching servers... Please be patient. Servers cached: \`${client.servers.counter}\`.`);
            if (uncached.length) message.channel.send(`⚠️[WARNING]⚠️: ${uncached.length} servers were unable to be cached properly.`);

            const servers = JSON.parse(JSON.stringify(client.servers.servers));
            delete servers.uncached;

            let link = args[0].replaceAll('https://', '');
            if (!link) return message.channel.send('Invalid link.');

            const embed = new MessageEmbed();
            const data = { fields: [], title: 'Scoreboard' };

            function scoreFormat(score) {
                if (score >= 1e6) return (score/1e6).toFixed(1) + "m";
                else if (score >= 1e3) return (score/1e3).toFixed(1) + "k";
                else return score + "";
            }

            let IDidIt = false;

            Object.entries(servers).forEach(function([gamemode, info]) {
                Object.entries(info).forEach(function([region, { lobbies }]) {
                    Object.entries(lobbies).forEach(function([id, lobby]) {
                        if (IDidIt) return;
                        
                        const { partylink, scoreboard } = lobby;
                        if (partylink != link) return;

                        Object.entries(scoreboard).forEach(function([placement, info], index) {
                            data.fields.push({
                                name: `${index + 1}. ${client.COLOR_MAP[info.color]} ${scoreFormat(parseInt(info.score))} ${info.tank} | **${info.name.replaceAll('_', '').replaceAll('*', '').replaceAll('\`', '').replaceAll('~', '') || 'unnamed'}**`,
                                value: `${gamemode} ${region} https://${partylink}`,
                            });
                        });

                        IDidIt = true;
                    });
                });
            });

            if (!data.fields.length) {
                embed.setDescription('Could not retreive scoreboard.');
                message.channel.send({ embeds: [embed] });
            } else {
                const { title, fields } = data;
                embed.setTitle(title);
                fields.forEach(function({ name, value }) {
                    embed.addField(name, value);
                });
                message.channel.send({ embeds: [embed] });
            }
        }

        else if (cmd == 'links') {
            const { isReady, uncached } = client.servers;
            if (!isReady) return message.channel.send(`Bot has not finished caching servers... Please be patient. Servers cached: \`${client.servers.counter}\`.`);
            if (uncached.length) message.channel.send(`⚠️[WARNING]⚠️: ${uncached.length} servers were unable to be cached properly.`);

            let link = args[0];
            if (!link) return message.channel.send('Invalid link.');
            link = link.replaceAll('https://', '').split('00')[0] || link.replaceAll('https://', '');

            if (client.servers.parties[link]) {
                const embed = new MessageEmbed()
                    .setTitle('Links')
                client.servers.parties[link].forEach(function(party, index) {
                    embed.addField(`${index + 1}.`, `https://${link}00${party}`);
                });
                message.channel.send('Found link in cache!');
                message.channel.send({ embeds: [embed] });
            } else {
                const embed = new MessageEmbed().setTitle('Links');

                let server = '';
                let partyCount = 2;
                client.serverList.forEach(function(s) {
                    if (s.partylink == link && ['teams', '4teams'].includes(s.gamemode)) {
                        server = `wss://${s.id}-80.lobby.${s.region}.hiss.io`;
                        partyCount = s.gamemode == 'teams' ? 2 : 4;
                    }
                });
                if (!server) return message.channel.send('Could not find server.');

                client.servers.parties[link] = [];
                message.channel.send('Finding links... This process may take well over 5 minutes, so grab some popcorn. This will be saved to memory once completed.');

                client.findParties(server, partyCount, link, message, embed);
            }
        }

        else if (cmd == 'diepstats') {
            const body = await fetch('https://diepstats.binary-person.dev/api/currentServers');
            const servers = await body.json();
            
            const embed = new MessageEmbed()
                .setTitle('DiepStats')
                .setURL('https://diepstats.binary-person.dev')
                .setColor('GREEN')
                .addField('Player Count', servers.playerCount.toString() || '???')
                .addField('Server Count', servers.serverCount.toString() || '???')
                .addField('Last Updated', ms(Date.now() - 1e3 * servers.lastUpdated, { verbose: true }) || '???')
                .setFooter({ text: 'Powered by Binary!' })
                .setTimestamp();
            message.channel.send({ embeds: [embed] });
        }

        else if (cmd == 'serverinfo') {
            let id = args[0];
            if (!id) return message.channel.send('Invalid Link/ID. Format: `https://diep.io/#123123` or `abcdeff-abcd-abcd-abcd-abcdefabcdeff`.');

            const _response = await fetch(`https://diepstats.binary-person.dev/api/lobbyData?id=${id}`);
            if (_response.status == 200) {
                function getServerLink(server) {
                    let link = '';
                    for (const char of server) {
                        const code = char.charCodeAt(0);
                        const value = (`00${code.toString(16)}`).slice(-2);
                        link += value.split("").reverse().join("");
                    }
                    return link;
                }

                const body = await _response.json();
                const embed = new MessageEmbed()
                    .setTitle('Server Info')
                    .setURL('https://diepstats.binary-person.dev')
                    .setColor('GREEN')
                    .addField('Status', body?.active == false ? 'closed' : (body?.active ? 'opened' : '???'))
                    .addField('Uptime', ms(Date.now() - 1e3 * body.createdAt, { verbose: true }) || '???')
                    .addField('Gamemode', body.gamemode || '???')
                    .addField('Region', body.region || '???')
                    .addField('Link', `https://diep.io/#${getServerLink(id).toUpperCase()}00`)
                    .addField('Player Count / Max Player Count (normal/direct/party)', `??/${body?.max_players_normal.toString() || '??'}/${body?.max_players_direct.toString() || '??'}/${body?.max_players_party.toString() || '??'}`)
                    .addField('Last Updated', ms(Date.now() - 1e3 * body?.lastUpdated, { verbose: true }) || 'Cannot retreive data.')
                    .setFooter({ text: 'Powered by Binary!' })
                    .setTimestamp();

                message.channel.send({ embeds: [embed] });
            } else {
                if (id.includes('https') || id.includes('diep.io/#'))
                    id = id.replace('https://', '').replace('diep.io/#', '');

                const hashes = id.match(/.{1,2}/g).map(function(nibble) { return nibble.split('').reverse().join(''); });

                let server, party;
                if (hashes.indexOf('00') != -1) 
                    party = hashes.splice(hashes.indexOf('00')).slice(1);
                server = hashes;
                server = server.map(function(nibble) { return String.fromCharCode(parseInt(nibble, 16)); }).join('');

                const response = await fetch(`https://diepstats.binary-person.dev/api/lobbyData?id=${server}`);
                const body = await response.json();

                if (body.err) return message.channel.send('Invalid Link/ID. Format: `https://diep.io/#123123` or `abcdeff-abcd-abcd-abcd-abcdefabcdeff`.');

                const embed = new MessageEmbed()
                    .setTitle('Server Info')
                    .setURL('https://diepstats.binary-person.dev')
                    .setColor('GREEN')
                    .addField('Status', body?.active ? 'open' : 'closed')
                    .addField('Uptime', ms(Date.now() - 1e3 * body.createdAt, { verbose: true }) || '???')
                    .addField('Gamemode', body.gamemode || '???')
                    .addField('Region', body.region || '???')
                    .addField('Lobby ID', server)
                    .addField('Player Count / Max Player Count (normal/direct/party)', `??/${body?.max_players_normal.toString() || '??'}/${body?.max_players_direct.toString() || '??'}/${body?.max_players_party.toString() || '??'}`)
                    .addField('Last Updated', ms(Date.now() - 1e3 * body?.lastUpdated, { verbose: true }) || 'Cannot retreive data.')
                    .setFooter({ text: 'Powered by Binary!' })
                    .setTimestamp();

                message.channel.send({ embeds: [embed] });
            }
        }
    
        else if (cmd == 'eval') {
            if (message.author.id != client.owner) return;
    
            const embed = new MessageEmbed();
        
            try {
                let evalled = eval(args.join(' '));
    
                if (typeof evalled != 'string')
                    evalled = require('util').inspect(evalled);
    
                embed.setColor('GREEN');
                embed.setTitle('Evaluation Successful!');
                embed.setDescription('The evaluation ran successfully.');
                embed.addField('Inputted Code', `\`\`\`js\n${args.join(' ')}\`\`\``);
                embed.addField(
                    'Outputted Code',
                    `\`\`\`js\n${evalled.includes(client.token) ? '🖕' : evalled}\`\`\``
                );
    
                message.channel.send({ embeds: [embed] }).catch(() => {});
            } catch (err) {
                embed.setColor('RED');
                embed.setTitle('Evaluation Unsuccessful!');
                embed.setDescription('The evaluation ran unsuccessfully.');
                embed.addField('Inputted Code', `\`\`\`js\n${args.join(' ')}\`\`\``);
                embed.addField(
                    'Error',
                    `\`\`\`js\n${err.message.includes(client.token) ? '🖕' : err}\`\`\``
                );
    
                message.channel.send({ embeds: [embed] }).catch(() => {});
            }
        }
    
        else if (cmd == 'update') {
            message.channel.send('Fetching last update...');
            client.XMLRequest('HEAD', 'https://diep.io', function(status, _r, xhr) {
                if (status == 1) {
                    message.channel.send(xhr.getResponseHeader('last-modified') || 'Couldn\'t find it.');
                } else {
                    message.channel.send('Couldn\'t load Diep.io.');
                }
            });
        }

        else if (cmd == 'uncached') {
            message.channel.send(client.servers.uncached.join('\n'));
        }
    
        else if (cmd == 'rawparse') {
            const packet = JSON.parse(args[0]);
            const parser = new Parser();

            parser.set(packet);
            const parsed = parser.parse();

            message.channel.send(parsed.type == 'UPDATE' ? JSON.stringify(parsed.data.scoreboard) : JSON.stringify(parsed))
                .catch(err => {
                    message.channel.send('Data too big. Logged in console. Error:', err);
                    console.log(parsed);
                });
        }
    });
    
    client.login('youaintgettingthisshit');
    
    process.on('unhandledRejection', function(err) {
        console.log('Error: ' + err);
        console.log('Stack\n' + err.stack);
    });
})();
