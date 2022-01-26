const DiscordUser = require("../../api/discord/DiscordUser");

const listener = {
    name: 'logUserJoin',
    eventName: 'guildMemberAdd',
    eventType: 'on',
    listener (member) {
        let discordUser = new DiscordUser(
            member.id,
            null,
            member.user.username,
            member.user.discriminator,
            member.users.avatar
        );
        discordUser.post().catch(console.error);
    }
};

module.exports = listener;