const con = require("../database");
const config = require("../config.json");

const {MessageEmbed} = require("discord.js");

const api = require("../api/index");

const getLiveChannel = () => {
    return new Promise((resolve, reject) => {
        global.client.discord.guilds.fetch(config.modsquad_discord).then(guild => {
            guild.channels.fetch(config.live_channel).then(channel => {
                resolve(channel);
            }, reject);
        }, reject);
    });
}

module.exports = () => {
    con.query("select distinct tu.id from identity__moderator as im join twitch__user as tu on tu.identity_id = im.modfor_id where im.active = true;", async (err, res) => {
        if (err) {
            console.error(err); return;
        }

        let channel = await getLiveChannel();

        let userList = [];

        let streams = [];

        const getStreams = async () => {
            const retrievedStreams = await api.Twitch.Direct.helix.streams.getStreams({
                limit: 100,
                userId: userList,
            });

            streams = [
                ...streams,
                ...retrievedStreams.data,
            ];

            userList = [];
        }

        for (let i = 0; i < res.length; i++) {
            userList = [
                ...userList,
                res[i].id
            ];

            if (userList.length === 100) await getStreams();
        }

        if (userList.length > 0) await getStreams();

        con.query("select identity_id from live where end_time is null;", async (errl, resl) => {
            if (errl) {
                console.error(errl);
                return;
            }

            let activeStreams = [];

            resl.forEach(liveChannel => {
                activeStreams = [
                    ...activeStreams,
                    liveChannel.identity_id,
                ]
            });
        
            for (let si = 0; si < streams.length; si++) {
                let stream = streams[si];
                let user = await api.Twitch.getUserById(stream.userId);
    
                if (user.identity?.id) {
                    let identity = await api.getFullIdentity(user.identity.id);
    
                    if (!activeStreams.includes(identity.id)) {
                        con.query("insert into live (identity_id) values (?);", [identity.id], async err => {
                            if (err) console.error(err);

                            const embed = new MessageEmbed()
                                .setTitle(`🔴 ${user.display_name} is now live!`)
                                .setColor(0x7d3bdc)
                                .setURL("https://twitch.tv/" + user.display_name.toLowerCase())
                                .setThumbnail(stream.getThumbnailUrl(256, 144))
                                .addField("Title", stream.title, true)
                                .addField("Game", stream.gameName, true)
                                .addField("Viewer Count", ""+stream.viewers, true)
                                .setTimestamp(stream.startDate)
                                .setFooter(`${user.display_name} : Live 🔴`, user.profile_image_url);
                
                            channel.send({content: ' ', embeds: [embed]});
                        });
                    } else {
                        activeStreams = activeStreams.filter(x => x != identity.id);
                    }
                }
            }

            activeStreams.forEach(async activeStream => {
                let identity = await api.getFullIdentity(activeStream);

                con.query("update live set end_time = now() where identity_id = ?;", [identity.id], err => {
                    if (err) {
                        console.error();
                        return;
                    }

                    let user = identity.twitchAccounts[0];

                    const embed = new MessageEmbed()
                        .setTitle(`${user.display_name} has gone offline!`)
                        .setColor(0x451b7f)
                        .setURL("https://twitch.tv/" + user.display_name.toLowerCase())
                        .setTimestamp(new Date())
                        .setFooter(`${user.display_name} : Offline`, user.profile_image_url);
        
                    channel.send({content: ' ', embeds: [embed]});
                });
            });
        });
    });
};
