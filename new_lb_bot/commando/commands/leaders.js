const { SlashCommandBuilder } = require('@discordjs/builders');

const data = new SlashCommandBuilder()
    .setName('leaders')
    .setDescription('Finds leaders in Diep.io!')
    .addStringOption(function(option) {
        return option.setName('region')
        .setDescription('Leaders given will only be in this region. (Split regions by ", ")');
    })
    .addStringOption(function(option) {
        return option.setName('gamemodes')
        .setDescription('Leaders given will only be in this gamemode. (Split gamemodes by ", ")');
    })
    .addStringOption(function(option) {
        return option.setName('score')
        .setDescription('Leaders given will only have at least this score.');
    });

module.exports = { data };