// Import required dependencies.
const pluralize = require('pluralize');
const fetch = require('node-fetch');
const { VM, VMScript } = require('vm2');
const fs = require('fs');

const fieldMap = require('./fieldMap');
const fieldStructure = require('./fields');

let BUILD;
let tables;

fetch('https://diep.io/')
.then(function(body) {
    body.text()
    .then(function(response) {
        BUILD = response.match(/[0-9a-f]{40}/)[0];

        for (var i = 0, seed = 1, res = 0, timer = 0; i < 40; i++) {
            let char = parseInt(BUILD[i], 16);
            res ^= (char << ((seed & 1) << 2)) << (timer << 3);
            timer = (timer + 1) & 3;
            seed ^= !timer;
        }

        Shufflers.MAGIC_NUM = res >>>= 0; Shufflers.TANK_XOR = res % TankTable.length; Shufflers.STAT_XOR = res % StatTable.length;
    });
});

const TankTable = [
    'Tank',
    'Twin',
    'Triplet',
    'Triple Shot',
    'Quad Tank',
    'Octo Tank',
    'Sniper',
    'Machine Gun',
    'Flank Guard',
    'Tri-Angle',
    'Destroyer',
    'Overseer',
    'Overlord',
    'Twin-Flank',
    'Penta Shot',
    'Assassin',
    'Arena Closer',
    'Necromancer',
    'Triple Twin',
    'Hunter',
    'Gunner',
    'Stalker',
    'Ranger',
    'Booster',
    'Fighter',
    'Hybrid',
    'Manager',
    'Mothership',
    'Predator',
    'Sprayer',
    '',
    'Trapper',
    'Gunner Trapper',
    'Overtrapper',
    'Mega Trapper',
    'Tri-Trapper',
    'Smasher',
    '', // Mega Smasher?
    'Landmine',
    'Auto Gunner',
    'Auto 5',
    'Auto 3',
    'Spread Shot',
    'Streamliner',
    'Auto Trapper',
    'Dominator', // Destroyer
    'Dominator', // Gunner
    'Dominator', // Trapper
    'Battleship',
    'Annihilator',
    'Auto Smasher',
    'Spike',
    'Factory',
    '', // Ball, Mounted Turret?
    'Skimmer',
    'Rocketeer',
];
const StatTable = [
    'Movement Speed',
    'Reload',
    'Bullet Damage',
    'Bullet Penetration',
    'Bullet Speed',
    'Body Damage',
    'Max Health',
    'Health Regen',
];

const Shufflers = {
    UPDATE: {},
    TANK_XOR: 0,
    STAT_XOR: 0,
    MAGIC_NUM: 0,
};
const fields = {};

let tanks = {};

TankTable.forEach(tank => {
    let tankID = (TankTable.indexOf(tank) ^ Shufflers.TANK_XOR) << 1;
    tank = tank.replaceAll(' ', '').replaceAll('-', '');

    tanks[tankID] = tank;
});

const Colors = {
    3: 'BLUE',
    4: 'RED',
    5: 'PURPLE',
    6: 'GREEN',
    13: 'WHITE',
};

const wasm = fs.readFileSync('./builds/build.txt', 'utf8');

const funcRegexp = /(label\$\d+ : \{\s+){67}/;
const groupRegexp = /\$\d+_1 = HEAP32\[\(\$0_1 \+ \d+ \| 0\) >> 2\] \| 0;/g;
const fieldRegexp = /HEAP8\[\(.+?(?=\+)\+ \d+ \| 0\) >> 0\] = 0;/g;

const fieldGroupMap = {};
const [labels] = wasm.match(funcRegexp);
const previousCode = wasm.split(labels)[0].split('function');
const functionOnward = previousCode[previousCode.length - 1];
const functionName = functionOnward.split('(')[0].replaceAll(' ', '');
const nextFunction = parseInt(functionName.replace('$', '')) + 1;
const [_, realOnward] = wasm.split(`function ${functionName}(`);

const func = `function ${functionName}(${realOnward.split(`function $${nextFunction}(`)[0]}`;
const groups = func.match(groupRegexp);
for (let hit of groups) {
    const funcName = hit.split("_")[0];
    const field = (parseInt(hit.split("+")[1].split("|")[0]) - 72) / 4;
    fieldGroupMap[funcName] = field;
}
const Fields = func.match(fieldRegexp);
let fieldnum = 0;

const entries = Object.entries(fieldStructure);

const fieldData = {};

entries.forEach(function([_, value]) {
    fieldData[value.name] = {};

    fieldData[value.name].type = value.type;
    if (value.repeat)
        fieldData[value.name].repeat = value.repeat;
});

for (let hit of Fields) {
    const funcName = hit.split("[(")[1].split("_")[0];
    let fieldgroup = fieldGroupMap[funcName];
    const pos = (parseInt(hit.split("+")[1].split("|")[0])) - 4;
    if (fieldgroup === undefined) {
        switch (pos) {
            case 11:
                fieldgroup = 9;
                break;
            case 8:
                fieldgroup = 7;
                break;
            case 10:
                fieldgroup = 9;
                break;
            default:
                fieldgroup = 7;
                break;
        }
    }
    const name = fieldMap[fieldgroup][pos];

    fields[fieldnum] = {
        "name": name,
        "group": fieldgroup,
        ...fieldData[name],
    };
    fieldnum++;
}

Shufflers.UPDATE.uptime = parseInt(wasm.match(/\d+ \^ \d+ \| 0;\s+HEAP32/)[0].split(' ^ ')[1].split(' |')[0]);
[Shufflers.UPDATE.deletion, Shufflers.UPDATE.upcreate] = wasm.match(/\d+ \| 0\) & 127/g).map(x => parseInt(x.split(' |')[0]));

const { solve_pow } = require('./build/Release/pow_solver');
const { decompress } = require('./build/Release/decompressor');

const { Reader, Writer } = require('./coder'); // Import CX88's Reader & Writer.

// Figure out shuffled values required to parse some packets, mainly 0x00 (UPDATE).

class Bīsmuth {
    constructor() {
        this.Tables = {"ENCODE_HEADERS":{"TIMES":[0,5,13,2,10,15,11,3,5,1,10,12,14,14,11,14,13,15,12,2],"TABLE":[0,17,65,53,71,8,11,62,27,15,12,9,23,47,52,89,69,1,37,36,6,45,48,16,35,87,84,33,116,39,107,13,119,79,100,43,40,18,44,21,93,63,97,78,59,7,51,55,49,109,72,68,91,81,96,29,111,41,50,99,82,61,121,30,80,120,126,101,66,19,83,5,102,95,24,85,42,108,122,124,14,73,117,64,92,112,90,25,22,31,28,77,113,57,60,3,46,103,105,34,2,75,104,32,123,20,38,74,26,54,94,67,110,106,115,76,10,88,56,127,125,86,114,70,98,118,4,58],"EXECUTION_TIMES":0},"DECODE_HEADERS":{"TIMES":[11,9,1,7,7,9,1,9,11,9],"TABLE":[26,1,94,35,6,85,3,100,98,114,14,115,12,33,108,74,8,71,126,101,72,90,42,78,18,103,30,27,62,43,56,83,25,109,17,76,9,97,54,110,40,121,4,39,52,68,32,123,82,60,120,79,21,75,64,104,16,89,29,69,53,81,11,99,58,51,23,61,50,96,36,95,116,113,59,44,66,48,31,117,124,47,13,119,5,57,112,125,73,88,67,122,70,63,2,34,80,93,0,107,37,102,92,41,28,45,86,65,22,20,24,127,10,46,118,15,106,105,84,91,38,19,111,77,55,49,7,87],"EXECUTION_TIMES":0},"ENCODE_BODY":[[158,184,254,56,197,51,136,237,252,92,94,161,131,84,189,48,103,116,126,231,151,33,57],[78,40,136,143,15,38,108,208,195,16,4,145,82,33,34,224,237,207,183,1,131,33,159],[154,155,172,138,103,212,51,85,229,108,153,153,42,240,46,136,218,175,234,34,195,27,255],[10,221,82,197,195,116,96,191,72,120,248,130,116,251,147,53,118,135,52,139,9,111,43],[152,87,227,231,190,224,213,198,37,28,190,151,72,29,210,102,70,34,199,33,193,170,217],[76,233,245,11,91,234,153,198,0,140,211,110,196,215,23,206,102,251,139,131,212,224,67],[140,160,201,218,253,175,214,172,136,180,1,86,193,142,199,224,170,22,99,77,63,229,179],[21,137,175,224,84,93,38,163,36,39,253,212,26,0,206,136,191,129,142,71,130,133,111],[5,208,166,206,209,90,225,20,152,239,92,77,149,125,44,45,184,156,99,134,53,76,93],[238,53,124,251,47,205,168,86,151,136,246,43,176,151,165,125,79,36,128,248,78,229,21],[39,127,53,72,12,237,44,155,202,120,108,3,2,32,144,51,95,55,99,73,34,66,60],[223,18,254,43,93,190,147,56,80,247,146,89,116,160,247,46,43,248,117,98,5,139,37],[161,149,137,130,234,159,255,246,94,137,79,222,141,4,151,56,174,14,11,148,244,41,88],[136,239,228,50,143,163,27,149,17,205,46,212,57,216,194,135,25,241,3,32,222,102,190],[196,74,27,143,27,254,124,10,13,0,108,164,72,241,127,232,158,1,253,81,19,4,245],[123,239,40,82,227,8,28,255,193,3,170,103,70,16,32,205,250,131,231,63,94,143,88],[200,185,146,95,201,23,46,252,24,89,163,138,223,110,105,117,246,240,94,167,11,28,134],[163,135,15,108,207,61,160,170,170,113,168,203,189,245,103,182,112,95,98,255,32,192,204],[220,202,243,149,134,179,189,173,229,89,22,242,28,220,213,122,152,75,6,204,253,232,181],[194,22,90,184,142,223,163,63,203,157,199,179,65,198,194,239,96,25,174,160,74,85,159],[79,138,66,46,9,238,114,184,14,254,47,77,123,221,98,37,181,171,176,185,63,50,184],[140,115,111,79,188,72,231,63,172,15,8,110,158,10,179,141,147,53,246,125,139,54,0],[214,86,166,202,127,115,96,0,121,79,149,103,96,85,125,155,28,51,24,28,233,212,196],[133,124,20,135,233,103,127,110,226,226,41,249,12,133,249,6,149,212,188,45,101,240,22],[186,171,45,190,96,161,119,16,94,245,52,39,16,107,124,105,206,5,18,195,49,120,158],[219,77,145,136,72,94,239,1,17,151,234,253,139,234,193,229,18,240,178,35,142,238,154],[180,247,78,208,145,137,247,223,193,88,103,96,215,26,204,180,109,236,122,185,112,143,126],[235,36,218,219,141,34,9,152,56,184,121,97,245,242,127,107,84,198,247,226,165,170,91],[3,114,4,249,197,37,70,134,154,65,83,248,70,36,200,6,184,201,39,45,84,45,147],[211,177,19,224,171,153,103,196,161,38,122,154,194,4,163,67,26,171,134,231,14,17,52],[108,103,28,23,19,114,64,78,73,148,58,172,218,24,209,205,123,143,119,232,168,53,223],[191,98,248,158,93,203,33,80,123,221,198,228,236,231,203,191,107,117,41,10,20,248,50]],"DECODE_BODY":[[172,242,131,8,16,194,64,227,199,94,123,165,28,109,236,167,166,3,0,189],[114,101,158,55,90,128,146,98,211,14,34,202,86,142,1,231,151,43,12,33],[169,38,190,58,41,253,254,225,245,250,2,29,255,178,81,52,129,178,253,236],[129,182,56,59,87,120,26,25,45,85,67,16,242,114,116,212,0,158,193,124],[75,198,193,88,113,177,237,115,242,214,69,127,201,68,86,187,211,88,235,172],[216,12,89,130,167,212,56,25,21,197,184,79,14,102,199,42,68,177,124,243],[227,155,224,82,213,56,163,55,72,3,197,59,89,97,37,239,81,197,157,98],[236,63,53,98,165,108,243,240,190,64,212,39,89,37,30,76,152,109,38,15],[181,115,90,142,84,130,182,206,208,109,168,137,128,98,236,214,159,46,127,59],[171,75,212,180,205,18,186,170,143,159,133,241,115,253,127,144,140,232,72,127],[168,216,69,185,170,182,202,141,201,105,239,42,48,134,21,249,198,254,102,91],[238,227,18,145,129,42,29,19,48,183,91,164,157,148,186,131,112,181,57,254],[29,86,159,141,119,235,90,37,22,93,163,224,38,217,53,254,116,218,110,203],[46,109,3,90,186,250,30,226,134,56,71,54,17,185,246,240,167,119,60,215],[146,26,52,74,33,144,200,241,89,239,160,124,86,201,17,215,38,39,223,124],[241,41,40,202,70,144,138,164,142,115,99,126,30,228,57,147,246,15,224,217],[113,123,97,60,75,213,171,216,55,70,252,166,58,43,219,12,93,85,108,253],[111,41,152,72,51,184,19,73,206,99,228,232,112,129,205,18,147,45,144,34],[220,168,237,148,126,76,52,167,164,180,138,171,216,140,142,7,218,106,13,137],[17,125,3,110,40,130,11,183,249,186,75,71,156,156,106,208,4,215,111,55],[156,41,141,224,105,8,29,231,63,141,200,143,96,225,241,160,245,198,42,145],[187,219,168,239,219,112,71,171,2,11,54,215,220,72,31,97,79,197,31,85],[185,51,175,226,15,147,97,101,110,37,169,198,194,59,238,110,73,85,74,4],[36,223,151,159,181,82,15,242,28,18,71,68,112,182,125,189,147,13,133,156],[255,1,30,202,17,227,94,120,22,181,201,36,164,12,67,96,252,219,175,84],[194,123,236,109,155,16,87,7,196,166,242,130,52,185,3,203,196,68,64,165],[199,12,231,172,94,101,0,28,146,227,151,211,86,189,8,14,202,131,1,167],[178,225,128,55,90,81,236,142,34,33,129,2,114,253,43,38,158,253,98,245],[120,29,114,0,58,26,254,255,59,67,25,41,250,16,178,56,158,169,190,52],[242,75,115,116,127,124,129,212,69,85,113,68,187,45,182,172,87,86,193,193],[88,197,201,68,177,235,216,88,177,42,12,14,198,214,237,56,242,211,21,89],[227,197,167,124,157,199,212,72,243,213,102,56,163,79,82,25,130,184,155,3],[59,64,152,239,108,63,197,89,165,212,98,37,76,55,81,97,224,39,89,98],[127,142,90,243,109,37,240,206,30,190,15,59,181,38,130,159,53,168,236,109],[128,143,236,232,144,205,170,115,46,180,208,182,137,84,140,214,115,127,159,98],[42,72,48,253,134,168,127,141,186,185,202,254,198,75,241,170,133,212,171,18],[254,57,131,91,249,201,69,239,102,42,105,181,216,48,182,129,19,145,238,21],[18,116,235,148,218,227,29,86,183,254,186,91,29,110,53,164,112,141,159,157],[38,22,119,186,203,224,46,90,90,163,240,71,93,217,60,54,37,134,246,109],[56,226,146,185,241,239,250,3,33,201,89,124,223,215,167,200,17,17,30,119],[126,70,228,52,39,142,124,202,144,26,160,215,74,147,115,144,30,86,164,38],[241,123,99,57,40,171,217,70,93,58,15,97,253,138,252,43,12,224,41,246],[75,73,129,219,213,228,113,108,144,112,18,85,166,205,184,34,45,60,216,55],[216,171,152,180,218,148,72,147,76,220,19,41,7,206,137,99,126,232,51,111],[106,142,249,156,167,138,125,71,52,4,168,55,164,110,13,75,140,106,237,40],[29,3,17,130,41,156,96,42,141,215,231,111,11,208,183,141,145,160,8,186],[219,241,200,215,11,105,245,156,224,225,112,171,198,220,31,168,143,85,97,63],[219,2,238,15,71,147,79,187,54,194,31,175,169,51,197,72,198,239,4,97],[159,68,101,74,181,151,85,36,73,185,37,59,82,226,110,242,13,18,110,189],[67,252,223,202,181,125,120,30,112,156,15,28,1,147,175,22,182,133,84,71]],"ENCODE_TIMES":0,"DECODE_TIMES":0};
    }

    set(packet) {
        this.packet = packet;
    }

    Header(header, type) {
        switch (type) {
            case 'encode': {
                const currentJump = this.Tables.ENCODE_HEADERS.TIMES[this.Tables.ENCODE_HEADERS.EXECUTION_TIMES];

                for (let i = 0; i <= currentJump; i++) {
                    header = this.Tables.ENCODE_HEADERS.TABLE[header];
                }

                this.Tables.ENCODE_HEADERS.EXECUTION_TIMES++;
                break;
            }
            case 'decode': {
                const currentJump = this.Tables.DECODE_HEADERS.TIMES[this.Tables.DECODE_HEADERS.EXECUTION_TIMES];

                for (let i = 0; i <= currentJump; i++) {
                    header = this.Tables.DECODE_HEADERS.TABLE[header];
                }

                this.Tables.DECODE_HEADERS.EXECUTION_TIMES++;
                break;
            }
        }
        return header;
    }
    Shuffle() {
        this.packet[0] = this.Header(this.packet[0], 'encode');

        for (let i = 1; i < this.packet.length; i++) {
            this.packet[i] ^= this.Tables.ENCODE_BODY[this.Tables.ENCODE_TIMES][i % 20];
        }

        this.Tables.ENCODE_TIMES++;
        return this.packet;
    }
    Unshuffle() {
        this.packet[0] = this.Header(this.packet[0], 'decode');
        
        for (let i = 1; i < this.packet.length; i++) {
            this.packet[i] ^= this.Tables.DECODE_BODY[this.Tables.DECODE_TIMES][i % 20];
        }

        this.Tables.DECODE_TIMES++;
        return this.packet;
    }
}

const Parser = class {
    constructor() {
        this.fields = fields;
        this.at = -1;
    }

    set(packet) {
        this.reader = new Reader(packet);
    }

    weakParse() {
        this.at++;

        switch (this.at) {
            case 0: {
                this.reader.buffer[0] = 2;
                return this.parse();
            }
            case 1: {
                this.reader.buffer[0] = 11;
                return this.parse();
            }
            default: {
                try {
                    this.reader.buffer[0] = 2;
                    const result = this.parse();
                    if (JSON.stringify(result.data.result.scoreboard) != '{}') return;
                    else return result.data.result.scoreboard;
                } catch (e) {
                    this.reader.buffer[0] = 0;

                    const result = this.parse();

                    if (JSON.stringify(result.data.scoreboard) == '{}') return;
    
                    return result;
                }
            }
        }
    }

    parse() {
        const data = {};

        switch (this.reader.vu()) {
            case 0x00: {
                data.scoreboardAmount = 10;
                data.deletions = [];
                data.fields = [];

                data.updates = {};
                data.creations = {};

                data.uptick = this.reader.vu() ^ Shufflers.UPDATE.uptime;

                data.deletionCount = this.reader.vu() ^ ((data.uptick + Shufflers.UPDATE.deletion) & 127);
                if (data.deletionCount > 1000 || isNaN(data.deletionCount) || data.deletionCount < 0) return;

                new Array(data.deletionCount).fill().forEach(() => {
                    const entity = this.reader.entityID();
                    data.deletions.push(entity);
                });
                data.upcreates = this.reader.vu() ^ ((data.uptick + Shufflers.UPDATE.upcreate) & 127);
                if (data.upcreates > 1000 || isNaN(data.upcreates) || data.upcreates < 0) return;

                data.scoreboard = {};

                new Array(data.upcreates).fill().forEach(() => {
                    const entity = this.reader.entityID();
                    this.index = -1;

                    const type = this.reader.i8();
                    switch (type) {
                        case 0x00: {
                            this.reader.vu();

                            while (true) {
                                const Element = this.reader.vu() ^ 1;
                                if (!Element) break;

                                this.index += Element;

                                const field = this.fields[this.index.toString()];
                                if (!field) return; 
                                const { name, type } = field;

                                const array = [];
                                let parsed = this.reader[type]('update');
                                array.push(...Array.isArray(parsed) ? parsed : [parsed]);

                                if (['scoreboardSuffixes', 'scoreboardNames', 'scoreboardScores', 'scoreboardTanks', 'scoreboardColors'].includes(name)) {
                                    const type = pluralize.singular(name.split('scoreboard')[1]).toLowerCase();
                                    
                                    for (let i = 0; i < parsed.length; ++i) {
                                        if (type == 'color') {
                                            parsed[i] = Colors[parsed[i]];
                                        } else if (type == 'tank') {
                                            parsed[i] = TankTable[i];
                                        }

                                        if (data.scoreboard[i]) {
                                            data.scoreboard[i][type] = parsed[i];
                                        } else {
                                            data.scoreboard[i] = {};
                                            data.scoreboard[i][type] = parsed[i];
                                        }
                                    }
                                }
                                
                                if (data.updates[entity]) {
                                    data.updates[entity][name] = array;
                                } else {
                                    data.updates[entity] = {};
                                    data.updates[entity][name] = array;
                                }
                            }
                            break;
                        }
                        case 0x01: {
                            data.fields = [];
                            while (true) {
                                const Element = this.reader.vu() ^ 1;
                                if (!Element) break;

                                this.index += Element;
                                data.fields.push(this.index);
                            }

                            Object.entries(this.fields).forEach(([key, value]) => {
                                if (data.fields.indexOf(value.group) == -1) return;

                                const array = [];
                                const parsed = this.reader[value.type]('create');
                                array.push(...Array.isArray(parsed) ? parsed : [parsed]);

                                if (['scoreboardSuffixes', 'scoreboardNames', 'scoreboardScores', 'scoreboardTanks', 'scoreboardColors'].includes(value.name)) {
                                    const type = pluralize.singular(value.name.split('scoreboard')[1]).toLowerCase();
                                    
                                    for (let i = 0; i < parsed.length; ++i) {
                                        if (type == 'color') {
                                            parsed[i] = Colors[parsed[i]];
                                        } else if (type == 'tank') {
                                            parsed[i] = TankTable[parsed[i]];
                                        }

                                        if (data.scoreboard[i]) {
                                            data.scoreboard[i][type] = parsed[i];
                                        } else {
                                            data.scoreboard[i] = {};
                                            data.scoreboard[i][type] = parsed[i];
                                        }
                                    }
                                }

                                if (value.name == 'scoreboardAmount') {
                                    data.scoreboardAmount = parsed;
                                }

                                if (data.creations[entity]) {
                                    data.creations[entity][value.name] = array;
                                } else {
                                    data.creations[entity] = {};
                                    data.creations[entity][value.name] = array;
                                }
                            });
                            
                            break;
                        }
                    }
                });
                for (let i = data.scoreboardAmount; i < 10; i++) delete data.scoreboard[i];
                delete this.reader;
                return { type: 'UPDATE', data };
            }
            case 0x01: {
                data.build = this.reader.stringNT();
                
                delete this.reader;
                return { type: 'INVALID_BUILD', data };
            }
            case 0x02: {
                data.length = this.reader.i32();

                data.buffer = new Uint8Array(decompress(this.reader.buffer.buffer));

                this.set(data.buffer);
                data.result = this.parse();

                delete this.reader;
                return { type: 'COMPRESSION', data };
            }
            case 0x03: {
                data.message = this.reader.stringNT();
                data.color = this.reader.little_endian();
                data.time = this.reader.f32();
                data.identifier = this.reader.stringNT() || 'None.';

                delete this.reader;
                return { type: 'NOTIFICATION', data };
            }
            case 0x04: {
                data.gamemode = this.reader.stringNT();
                [data.host, data.region] = this.reader.stringNT().split('-');

                delete this.reader;
                return { type: 'SERVER_INFO', data };
            }
            case 0x05: {
                data.timestamp = Date.now();

                delete this.reader;
                return { type: 'PONG', data };
            }
            case 0x06: {
                data.party = Array.from(this.reader.buffer.slice(this.reader.at)).map(function(int) { 
                    let str = int.toString(16).toUpperCase().split('').reverse().join('');
                    if (str.length < 2) str += '0';

                    return str;
                }).join('');

                delete this.reader;
                return { type: 'PARTY', data };
            }
            case 0x07: {
                delete this.reader;
                return { type: 'ACCEPT' };
            }
            case 0x08: {
                data.amount = this.reader.vu();
                data.achievements = [];

                for (let i = 0; i < data.amount; i++) {
                    data.achievements.push(this.reader.stringNT());
                }

                delete this.reader;
                return { type: 'ACHIEVEMNT', data };
            }
            case 0x09: {
                delete this.reader;
                return { type: 'INVALID_PARTY_LINK', data };
            }
            case 0x0a: {
                data.players = this.reader.vu();

                delete this.reader;
                return { type: 'PLAYER_COUNT', data };
            }
            case 0x0b: {
                let speed = Date.now();

                data.difficulty = this.reader.vu();
                data.prefix = this.reader.stringNT();
                data.result = solve_pow(...data.prefix.split('').map(l => l.charCodeAt()), data.difficulty);
                data.speed = Date.now() - speed;

                delete this.reader;
                return { type: 'POW_CHALLENGE', data };
            }
            case 0x0d: { 
                let speed = Date.now();
                function handleResult(result) {
                    if (typeof result == 'string' && regex.test(result)) {
                        data.result = result;
                    };
                    revoke();
                }

                // vm2 removed due to not being public
                const { proxy, revoke } = Proxy.revocable(handleResult, {});

                const vm = new VM({ timeout: 14000, sandbox: { handleResult: proxy }});
                vm.run(BrowserEnv);


                data.id = this.reader.vu();
                data.code = this.reader.stringNT();
                vm.run(`new Function(${JSON.stringify(data.code)})()(handleResult);`);
                data.speed = Date.now() - speed;

                delete this.reader;
                return { type: 'JS_CHALLENGE', data };
            }
            default: {
                return { error: 'INVALID_PACKET', message: `Invalid packet header. Packet header sent: ${this.reader.buffer[0]}.` };
            }
        }
    }
}

const Generator = class {
    constructor() {
        this.packet = new Writer();
    }

    set(info) {
        this.info = info;
    }

    generate() {
        const { header } = this.info;

        switch (header) {
            case 'INIT': {
                const { build, password, party, token } = this.info;
                this.packet = this.packet.vu(0x00).string(build).string(password).string(party).string(token).string('');
                
                break;
            }
            case 'INPUT': {
                const { flags, mouseX, mouseY, gamepadX, gamepadY} = this.info;
                this.packet = this.packet.vu(0x01).flags(flags).vf(mouseX).vf(mouseY);
                if (gamepadX && gamepadY) this.packet = this.packet.vf(gamepadX).vf(gamepadY);
                else this.packet = this.packet;

                break;
            }
            case 'SPAWN': {
                const { name } = this.info;
                this.packet = this.packet.vu(0x02).string(name);

                break;
            }
            case 'UPGRADE_BUILD': {
                const { stat, max } = this.info;
                const realStat = (StatTable.indexOf(stat) ^ Shufflers.STAT_XOR) << 1;
                this.packet = this.packet.vu(0x03).vu(realStat).vi(max);

                break;
            }
            case 'UPGRADE_TANK': {
                const { tank } = this.info;
                this.packet = this.packet.vu(0x04).vu(tanks[tank]);

                break;
            }
            case 'PING': {
                this.packet = this.packet.vu(0x05);

                break;
            }
            /*case 'TCP_INIT': {
                this.packet = this.packet.vu(0x06).string('i\'m an idiot');
                break;
            }
            case 'EXTENSION_FOUND': {
                this.packet = this.packet.vu(0x07).string('6ix9ined myself');
                break;
            }*/
            case 'CLEAR_DEATH': {
                this.packet = this.packet.vu(0x08);
                break;
            }
            case 'TAKE_TANK': {
                this.packet = this.packet.vu(0x09);
                break;
            }
            case 'POW_CHALLENGE_REPLY': {
                const { result } = this.info;
                this.packet = this.packet.vu(0x0a).string(result);

                break;
            }
            case 'JS_CHALLENGE_REPLY': {
                const { id, result } = this.info;
                this.packet = this.packet.vu(0x0b).vu(id).vu(result);

                break;
            }
        }

        delete this.info;
        const result = this.packet.out();
        this.packet = new Writer();
        return new Uint8Array(result);
    }
}

process.on('unhandledRejection', function(err) {
    console.log('Error: ' + err);
    console.log('Stack\n' + err.stack);
});

module.exports = { Parser, Generator, Bīsmuth, TankTable };