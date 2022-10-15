const { SlashCommandBuilder } = require('@discordjs/builders');

const data = new SlashCommandBuilder()
    .setName('links')
    .setDescription('Finds parties of a server.')
    .addStringOption(function(option) {
        return option.setName('link')
        .setDescription('The link to get the parties of.')
        .setRequired(true);
    });

module.exports = { data };