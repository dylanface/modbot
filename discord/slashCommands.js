const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require("fs");
const config = require("../config.json");

const commandFiles = fs.readdirSync('./discord/commands').filter(file => file.endsWith('.js'));

let commands = [];

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands = [
        ...commands,
        command.data
    ]
}

const rest = new REST({ version: '9' }).setToken(config.discord.token);

module.exports = (async client => {
    try {
        // await rest.put(
		// 	Routes.applicationCommands(config.discord.application),
		// 	{ body: commands },
		// );

        await rest.delete(
            Routes.applicationCommand(config.discord.application, "875833711860523108")
        );

        console.log('[MB] Successfully set commands');
    } catch (error) {
        console.error(error);
    }
});