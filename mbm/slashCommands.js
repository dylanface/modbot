const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require("fs");
const config = require("../config.json");

const commandFiles = fs.readdirSync('./mbm/commands').filter(file => file.endsWith('.js'));

let commands = [];

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands = [
        ...commands,
        command.data
    ]
}

const rest = new REST({ version: '9' }).setToken(config.mbm.token);

module.exports = (async client => {
    try {
        await rest.put(
			Routes.applicationCommands(config.mbm.application),
			{ body: commands },
		);

        console.log('[MBM] Successfully set commands');
    } catch (error) {
        console.error(error);
    }
});