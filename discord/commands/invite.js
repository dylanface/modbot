const {MessageEmbed} = require("discord.js");
const {IdentityService, BackendAPI} = require("../../api");
const con = require("../../database");

const command = {
    data: {
        name: 'invite'
        , description: 'Generates a link to send to others'
    },
    execute(interaction) {
        let code = BackendAPI.stringGenerator(6);

        IdentityService.resolveByDiscordId(interaction.user.id).then(identity => {
            con.query("insert into invite (invite, initiated_by, expiry) values (?, ?, date_add(now(), interval 30 minute));", [code, identity.id], () => {
                const embed = new MessageEmbed()
                    .setTitle("Invite Link")
                    .setDescription(`Send this link to invite your friends to TMSQD!\n\nhttps://join.tmsqd.co/${code}\n\n**Do not allow others to use this link to invite others. This link will expire in 30 minutes.**`)
                    .setColor(0x772ce8);

                interaction.reply({content: ' ', embeds: [embed], ephemeral: true});
            });
        }).catch(error => {
            const embed = new MessageEmbed()
                .setTitle("Invite Generation Error!")
                .setDescription(`Error: ${error}`)
                .setColor(0x772ce8);

            interaction.reply({content: ' ', embeds: [embed], ephemeral: true});
        });
    }
};

module.exports = command;