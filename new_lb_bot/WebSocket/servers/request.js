const fetch = require('node-fetch');
const ms = require('ms');

const DiepCacheSystem = class {
    constructor() {
        this.servers = {};
    }

    async request(raw) {
        if (raw) console.error('Unsupported method. Defaulting to Binary API.');
        this.servers = await fetch('https://diepstats.binary-person.dev/api/currentServers').then(r => r.json());

        return this.servers;
    }
}; 

module.exports = { DiepCacheSystem };