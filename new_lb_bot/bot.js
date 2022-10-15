const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Client, MessageEmbed, MessageActionRow, MessageButton, Message } = require('discord.js');

const { WebSocketManager } = require('./WebSocket/connection/socket');
const { DiepCacheSystem } = require('./WebSocket/servers/request');
const { CommandSystem } = require('./commando/main');

const rest = new REST({ version: 9 }).setToken('no');

class SharpClient extends Client {
    constructor(options) {
        super(options);

        this.WebSocketManager = new WebSocketManager();
        this.DiepCacheSystem = new DiepCacheSystem();
        this.ServerManager = {
            servers: {
                uncached: [],
            },
            _servers: {
                parsed: 0,
                uncached: [],
            },

            diepServers: {},
        };
        this.CommandSystem = new CommandSystem();


        this.Messages = new Map();

        this.CommandSystem.setDirectory('commands');
        this.CommandSystem.fetchCommands();

        this._refreshCommands();

        const interval = async () => {
            console.log('Starting interval...');
            await this._resetServers();
            await this._seekServers(this.ServerManager._servers.parsed || 0);
            setInterval(async () => {
                await this._resetServers();
                await this._seekServers(this.ServerManager._servers.parsed || 0);
            }, 3e5);
        };
        interval();
    }

    async _refreshCommands() {
        try {
            console.log('Refreshing application (/) commands...');

            await rest.put(Routes.applicationGuildCommands(this.user?.id || '949734148338249748', '949738303874302062'), {
                body: this.CommandSystem.commands,
            });
        } catch (error) {
            console.error(error);
            console.error('Could not refresh application (/) commands.');
            console.log('Retrying to refresh commands...');
            await this._refreshCommands();
        }
    }

    async _resetServers() {
        this.ServerManager.diepServers = await this.DiepCacheSystem.request();
    }

    async _seekParties(link, count, url, counter = 0) {
        this.WebSocketManager.connect(url, true)
        .then(party => {
            let l = `https://${link}00${party}`;
            if (!this.ServerManager.servers[link].links.includes(l)) {
                console.log('New link found!', l);
                this.ServerManager.servers[link].links.push(l); 
            }

            if (this.ServerManager.servers[link].links.length == count) return;
            if (counter <= 250) {
                this._seekParties(link, count, url, counter++);
            } else {
                this.ServerManager.servers[link].links.push(`ERROR: 250+ attempts have been made.`);
            }
        })
        .catch(error => {
            this.ServerManager.servers[link].links.push(`ERROR: ${error}`);
        });
    }

    async _seekServers(count = 0) {    
        let server = this.ServerManager.diepServers.servers[count];
        let url = `wss://${server.id}-80.lobby.${server.region}.hiss.io/`;

        if (['tag', 'survival', 'dom', 'sandbox'].includes(server.gamemode)) {
            console.log('Incorrect gamemode.');
            this.ServerManager._servers.parsed++;
            this._seekServers(count + 1);
            return;
        }

        this.WebSocketManager.connect(url, false)
        .then((scoreboard) => {
            this.ServerManager._servers[server.partylink] = {
                links: [],
                scoreboard,
            };

            if (!this.ServerManager.diepServers.servers[count + 1]) {
                console.log('Finished server caching!');
                delete this.ServerManager._servers.parsed;
                this.ServerManager.servers = JSON.parse(JSON.stringify(this.ServerManager._servers));
                this.ServerManager._servers = {
                    parsed: 0,
                    uncached: [],
                };
            } else {
                this.ServerManager._servers.parsed++;
                this._seekServers(count + 1);
            }
        })
        .catch((error) => {
            console.error(error);

            this.ServerManager._servers.uncached.push(server.partylink);

            if (!this.ServerManager.diepServers.servers[count + 1]) {
                console.log('Finished caching servers!');
                delete this.ServerManager._servers.parsed;
                this.ServerManager.servers = this.ServerManager._servers;
                this.ServerManager._servers = {
                    servers: {
                        uncached: [],
                    },
                    _servers: {
                        parsed: 0,
                        uncached: [],
                    },
        
                    diepServers: {},
                };
            } else {
                console.log('Continuing past error...');
                this.ServerManager._servers.parsed++;
                this._seekServers(count + 1);
            }
        });
    }
}

const client = new SharpClient({ intents: [32767] });

client.once('ready', function() { console.log('Bot is ready!'); });
client.on('interactionCreate', async function(interaction) {
    if (interaction.isCommand()) {
        switch (interaction.commandName) {
            case 'leaders': {
                if (Object.keys(client.ServerManager.servers).length == 1) return interaction.reply({ content: `Servers have not been fully found yet. **${client.ServerManager._servers.parsed}** scoreboards have been found.`, ephemeral: true, });
                if (client.ServerManager.servers.uncached.length) interaction.channel.send({ content: `${client.ServerManager.servers.uncached.length} servers have not been parsed successfully.` });

                let regions = interaction.options.getString('region')?.split(', ') || [];
                let gamemodes = interaction.options.getString('gamemodes')?.split(', ') || [];
                let score = interaction.options.getString('score') || 350000;

                if (typeof score == 'string') {
                    if (score.endsWith('k') || score.endsWith('m')) {
                        let zeros = score.endsWith('k') ? 3 : 6;
                        score = parseInt(score) * parseInt(`1${'0'.repeat(zeros)}`);
                    } else {
                        score = parseInt(score);
                    }
                }

                if (isNaN(score) || typeof score != 'number') return interaction.reply({
                    content: 'Invalid argument `score`.',
                    ephemeral: true,
                });

                const ValidModes = {
                    'ffa': 'ffa',
                    'teams': 'teams',
                    '2teams': 'teams',
                    '2tdm': 'teams',
                    '4teams': '4teams',
                    '4tdm': '4teams',
                    'maze': 'maze',
                };
                const ValidRegions = {
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
                const ColorMap = {
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

                let issues = false;
                let realRegions = [];

                regions.forEach(function(region) {
                    if (!ValidRegions[region]) issues = 'region';
                    else realRegions.push(ValidRegions[region]);
                });

                let realModes = [];
                gamemodes.forEach(function(mode) {
                    if (!ValidModes[mode]) issues = 'gamemode';
                    else realModes.push(ValidModes[mode]);
                });

                gamemodes = realModes;
                regions = realRegions;

                if (gamemodes.length == 0) gamemodes = ['ffa', 'teams', '4teams', 'maze'];
                if (regions.length == 0) regions = ['lnd-sfo', 'lnd-atl', 'lnd-fra', 'lnd-syd'];

                if (issues) return interaction.reply({
                    content: `Invalid ${issues}(s). Valid ${issues}s: \`${issues == 'region' ? Object.keys(ValidRegions).join(', ') : Object.keys(ValidModes).join(', ')}\`.`,
                    ephemeral: true,
                });

                const servers = JSON.parse(JSON.stringify(client.ServerManager.servers));
                delete servers.uncached;

                let scores = [];
                Object.entries(servers).forEach(function([partylink, { scoreboard }]) {
                    const server = client.DiepCacheSystem.servers.servers.filter(server => { return server.partylink == partylink })?.[0];

                    for (let [_, value] of Object.entries(scoreboard)) {
                        if (value.score >= score
                        && gamemodes.includes(server.gamemode)
                        && regions.includes(server.region)) {
                            scores.push({
                                playerInfo: value,
                                gamemode: server.gamemode,
                                region: server.region,
                                party: partylink,
                            });
                        }
                    }
                });

                scores = scores.sort(function(score1, score2) { return score2.playerInfo.score - score1.playerInfo.score });

                if (scores.length > 25) {
                    function scoreFormat(score) {
                        if (score >= 1e6) return (score/1e6).toFixed(1) + "m";
                        else if (score >= 1e3) return (score/1e3).toFixed(1) + "k";
                        else return score + "";
                    }

                    const embed = new MessageEmbed();
                    const data = {};

                    let count = Math.ceil(scores.length / 25);
                    for (let p = 0; p < count; p++) {
                        data[p] = {
                            title: `Current Leaders (${p + 1}/${count})`,
                            fields: [],
                        };

                        for (let i = p * 25; i < p * 25 + 25; i++) {
                            let score = scores[i];
                            console.log(score, i);
                            if (!score) break;

                            const { playerInfo, gamemode, region, party } = score;
                            data[p].fields.push({
                                name: `${i + 1}. ${ColorMap[playerInfo.color]} ${scoreFormat(parseInt(playerInfo.score))} ${playerInfo.tank} | **${playerInfo.name || 'unnamed'}**`,
                                value: `${gamemode} ${region} https://${party}`,
                            });
                        }
                    }

                    const { title, fields } = data[0];
                    console.log(fields);
                    embed.setTitle(title);
                    fields.forEach(function({ name, value }) {
                        embed.addField(name, value);
                    });

                    const row = new MessageActionRow()
                        .addComponents(new MessageButton().setCustomId('next').setLabel('➡️').setStyle('PRIMARY'));

                    interaction.reply({ embeds: [embed], components: [row], });
                    client.Messages.set(interaction.id, {
                        data,
                        currentPage: 0,
                        author: interaction.member.id,
                    });
                } else {
                    const embed = new MessageEmbed();

                    if (!scores.length) {
                        embed.setDescription('No leaders were found...');
                        interaction.reply({ embeds: [embed] });
                    } else {
                        function scoreFormat(score) {
                            if (score >= 1e6) return (score/1e6).toFixed(1) + "m";
                            else if (score >= 1e3) return (score/1e3).toFixed(1) + "k";
                            else return score + "";
                        }

                        embed.setTitle('Current Leaders');
                        
                        for (let i = 0; i < 25; i++) {
                            const info = scores[i];
                            if (!info) break;

                            const { playerInfo, gamemode, region, party } = info;

                            embed.addField(`${i + 1}. ${ColorMap[playerInfo.color]} ${scoreFormat(parseInt(playerInfo.score))} ${playerInfo.tank} | **${playerInfo.name || 'unnamed'}**`,
                            `${gamemode} ${region} https://${party}`);
                        }

                        interaction.reply({ embeds: [embed] });
                    }
                }
                break;
            }
            case 'uncached': {
                const embed = new MessageEmbed();
                embed.setTitle('Uncached Servers');
                embed.setDescription(`${client.ServerManager.servers.uncached.length ? client.ServerManager.servers.uncached.join('\n') : 'Every server has been cached (hopefully).'}`)

                interaction.reply({
                    embeds: [embed],
                });
                break;
            }
            case 'scoreboard': {
                const link = interaction.options.getString('link').replace('https://', '');

                const info = client.ServerManager.servers[link];
                if (!info) return interaction.reply({ content: `${client.ServerManager.servers.uncached.includes(link) ? 'Link is uncached, cannot retreive scoreboard.' : 'Invalid link.'}`, ephemeral: true });

                const { scoreboard } = info;
                const embed = new MessageEmbed().setTitle('Scoreboard');

                function scoreFormat(score) {
                    if (score >= 1e6) return (score/1e6).toFixed(1) + "m";
                    else if (score >= 1e3) return (score/1e3).toFixed(1) + "k";
                    else return score + "";
                }

                const ColorMap = {
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

                let description = '';

                for (let i = 0; i < 10; i++) {
                    const playerInfo = scoreboard[i];
                    if (!playerInfo) break;

                    description += `${i + 1}. ${ColorMap[playerInfo.color]} ${scoreFormat(playerInfo.score)} ${playerInfo.tank} | **${playerInfo.name || 'unnamed'}**\n`;
                }

                embed.setDescription(description);
                interaction.reply({ embeds: [embed] });
                break;
            }
            case 'find': {
                const name = interaction.options.getString('name');

                let servers = JSON.parse(JSON.stringify(client.ServerManager.servers));
                delete servers.parsed;
                delete servers.uncached;

                let entries = [];

                Object.entries(servers).forEach(function([partylink, { scoreboard }]) {
                    console.log(partylink);
                    const server = client.DiepCacheSystem.servers.servers.filter(server => { return server.partylink == partylink })?.[0];

                    for (let [_, value] of Object.entries(scoreboard)) {
                        if (value.name.includes(name)) entries.push({
                            info: value,
                            server: server,
                        });
                    }
                });

                function scoreFormat(score) {
                    if (score >= 1e6) return (score/1e6).toFixed(1) + "m";
                    else if (score >= 1e3) return (score/1e3).toFixed(1) + "k";
                    else return score + "";
                }

                const ColorMap = {
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

                entries = entries.sort(function(score1, score2) { return score2.info.score - score1.info.score });
                const embed = new MessageEmbed().setTitle('Names');

                entries.forEach(function({ info, server }, index) {
                    embed.addField(`${index + 1}. ${ColorMap[info.color]} ${scoreFormat(info.score)} ${info.tank} | **${info.name || 'unnamed'}**`, `${server.gamemode} ${server.region} https://${server.partylink}`);
                });
                if (!embed.fields.length) embed.setDescription('No people were found with specified name.');

                interaction.reply({ embeds: [embed] });
                break;
            }
            case 'links': {
                const link = interaction.options.getString('link').replace('https://', '');

                if (client.ServerManager.servers.uncached.includes(link)) return interaction.reply({ content: 'Link is uncached and PartyFinder will not be attempted.', ephemeral: true, });
                const server = client.DiepCacheSystem.servers.servers.filter(server => { return server.partylink == link })?.[0];
                if (!server) return interaction.reply({ content: 'Invalid link.', ephemeral: true });
                if (!['4teams', 'teams'].includes(server.gamemode)) return interaction.reply({ content: 'Gamemode is not 2Teams or 4Teams.', ephemeral: true });

                let count = server.gamemode == '2teams' ? 2 : 4;
                const embed = new MessageEmbed().setTitle('Links');

                client._seekParties(link, count, `wss://${server.id}-80.lobby.${server.region}.hiss.io/`);
                interaction.deferReply();
                
                const interval = setInterval(function() {
                    let currentIdx = client.ServerManager.servers[link][client.ServerManager.servers[link].length];
                    if (currentIdx.includes('ERROR')) {
                        embed.setDescription(`Error: ${currentIdx.replace('ERROR: ')}.`);
                        interaction.reply({ embeds: [embed], allowedMentions: { repliedUser: true, }, });   
                        clearInterval(interval);
                    } else if (client.ServerManager.servers[link].length == count) {
                        embed.setDescription(client.ServerManager.servers[link].join('\n'));
                        interaction.reply({ embeds: [embed], allowedMentions: { repliedUser: true, }, });   
                        clearInterval(interval);
                    }
                }, 1000);
            }
            default: { console.log(interaction.commandName) };
        }
    } else if (interaction.isButton()) {
        const info = client.Messages.get(interaction.message.interaction.id);
        if (!info) return;

        let { data, currentPage, author } = info;
        if (author != interaction.member.id) return; 

        if (interaction.component.label == '➡️') {
            currentPage++;
        } else {
            currentPage--;
        }

        const embed = new MessageEmbed();
        const { title, fields } = data[currentPage];
        embed.setTitle(title);
        fields.forEach(function({ name, value }) { embed.addField(name, value); });
        
        const row = new MessageActionRow();

        if (currentPage >= 1) {
            row.addComponents(new MessageButton().setCustomId('before').setLabel('⬅️').setStyle('PRIMARY'));
        }
        if (currentPage + 1 < Object.values(data).length) {
            row.addComponents(new MessageButton().setCustomId('next').setLabel('➡️').setStyle('PRIMARY'));
        }

        interaction.update({ embeds: [embed], components: [row] });
        client.Messages.set(interaction.message.interaction.id, {
            data,
            currentPage,
            author,
        });
    }
});

client.login('no');

process.on('unhandledRejection', function(rejection) { console.log(rejection); });
process.on('uncaughtException', function(exception) { console.log(exception); });
