const con = require("./database");
const config = require("./config.json");

const {ApiClient} = require("twitch");
const {ClientCredentialsAuthProvider} = require("twitch-auth");

const authProvider = new ClientCredentialsAuthProvider(config.twitch.client_id, config.twitch.client_secret);
const api = new ApiClient({ authProvider });

class SessionService {
    resolveSession(sessionId) {
        return new Promise((resolve, reject) => {
            con.query("select id, identity_id, created from session where id = ?;", [sessionId], (err, res) => {
                if (err) {reject(err);return;}

                if (res.length > 0) {
                    resolve(res[0]);
                } else {
                    reject("Session not found");
                }
            });
        })
    }
}

class IdentityService {
    resolveIdentity(identityId, includeStreamers = true) {
        return new Promise((resolve, reject) => {
            let identity = {avatar_url: "https://p.tmsqd.co/assets/images/bop.png"};
            con.query("select id, name from identity where id = ?;", [identityId], (err, res) => {
                if (err) {reject(err);return;}

                if (res.length > 0) {
                    const tus = new TwitchUserService();
                    const dus = new DiscordUserService();

                    identity.id = res[0].id;
                    identity.name = res[0].name;

                    tus.resolveIdentityProfiles(identityId).then(twitchProfiles => {
                        identity.profiles = {twitch: twitchProfiles};

                        if (twitchProfiles.length > 0) {
                            twitchProfiles.forEach(profile => {
                                if (profile.profile_image_url !== null && profile.profile_image_url !== "") {
                                    identity.avatar_url = profile.profile_image_url;
                                }
                            });
                        }

                        dus.resolveIdentityProfiles(identityId).then(discordProfiles => {
                            identity.profiles.discord = discordProfiles;

                            if (discordProfiles.length > 0) {
                                discordProfiles.forEach(profile => {
                                    if (profile.avatar !== null && profile.avatar !== "") {
                                        identity.avatar_url = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`;
                                    }
                                });
                            }

                            if (includeStreamers) {
                                this.getStreamers(identity.id).then(streamers => {
                                    identity.streamers = streamers;

                                    resolve(identity);
                                }).catch(reject);
                            } else {
                                resolve(identity);
                            }
                        }).catch(reject);
                    }).catch(reject);
                } else {
                    reject("Identity not found");
                }
            });
        });
    }

    unlinkModerators(moderatorId) {
        return new Promise((resolve, reject) => {
            con.query("delete from identity__moderator where identity_id = ?;", [moderatorId], err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    linkModerator(moderatorId, streamerId) {
        return new Promise((resolve, reject) => {
            con.query("select * from identity__moderator where identity_id = ? and modfor_id = ?;", [moderatorId, streamerId], (err, res) => {
                if (!err) {
                    if (res.length === 0) {
                        con.query("insert into identity__moderator (identity_id, modfor_id) values (?, ?);", [moderatorId, streamerId], err => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    } else {
                        resolve();
                    }
                } else {
                    reject(err);
                }
            });
        });
    }

    getStreamers(moderatorId) {
        return new Promise((resolve, reject) => {
            con.query("select identity.id from identity__moderator join identity on identity.id = identity__moderator.modfor_id where identity__moderator.identity_id = ?;", [moderatorId], async (err, res) => {
                if (err) {reject(err);return;}
                let result = [];

                for (var i = 0; i < res.length; i++) {
                    result = [
                        ...result,
                        await this.resolveIdentity(res[i].id, false),
                    ];
                }

                resolve(result);
            });
        });
    }

    resolveByDiscordId(id) {
        return new Promise((resolve, reject) => {
            con.query("select identity_id from discord__user where id = ?;", [id], (err, res) => {
                if (err) {console.error(err);return;}

                if (res.length > 0) {
                    this.resolveIdentity(res[0].identity_id).then(resolve).catch(reject);
                } else {
                    reject("User was not found with that ID");
                }
            });
        });
    }

    resolveByTwitchId(id) {
        return new Promise((resolve, reject) => {
            con.query("select identity_id from twitch__user where id = ?;", [id], (err, res) => {
                if (err) {console.error(err);return;}

                if (res.length > 0) {
                    this.resolveIdentity(res[0].identityId).then(resolve).catch(reject);
                } else {
                    reject("User was not found with that ID");
                }
            });
        });
    }
}

class TwitchUserService {

    #resolveUserObj(result) {
        return {
            id: result.id,
            display_name: result.display_name,
            profile_image_url: result.profile_image_url,
            offline_image_url: result.offline_image_url,
            description: result.description,
            view_count: result.view_count,
            follower_count: result.follower_count,
            affiliation: result.affiliation,
            identity: {
                id: result.identity_id,
                name: result.identity_name,
            },
        };
    }

    resolveByName(userName) {
        return new Promise((resolve, reject) => {
            con.pquery("select twitch__user.id, display_name, identity_id, identity.name as identity_name, email, profile_image_url, offline_image_url, description, view_count, follower_count, affiliation from twitch__user left join identity on identity.id = twitch__user.identity_id where display_name = ?;", [userName]).then(async result => {
                if (result.length > 0) {
                    let user = result[0];
                    resolve(this.#resolveUserObj(user));
                } else {
                    let helixUser = await api.helix.users.getUserByName(userName);

                    if (helixUser) {
                        con.query("insert into twitch__user (id, display_name, identity_id, email, profile_image_url, offline_image_url, description, view_count, follower_count, affiliation) values (?, ?, null, null, ?, ?, ?, ?, null, ?);", [
                            helixUser.id,
                            helixUser.displayName,
                            helixUser.profilePictureUrl,
                            helixUser.offlinePlaceholderUrl,
                            helixUser.description,
                            helixUser.views,
                            (helixUser.broadcasterType === "" ? null : helixUser.broadcasterType),
                        ]);

                        resolve({
                            id: helixUser.id,
                            display_name: helixUser.displayName,
                            profile_image_url: helixUser.profilePictureUrl,
                            offline_image_url: helixUser.offlinePlaceholderUrl,
                            description: helixUser.description,
                            view_count: helixUser.views,
                            follower_count: null,
                            affiliation: helixUser.broadcasterType,
                            identity: {
                                id: null,
                                name: null,
                            },
                        });
                    } else {
                        reject("User not found");
                    }
                }
            }).catch(reject);
        });
    }

    resolveById(userId, displayName = null) {
        return new Promise((resolve, reject) => {
            con.pquery("select twitch__user.id, display_name, identity_id, identity.name as identity_name, email, profile_image_url, offline_image_url, description, view_count, follower_count, affiliation from twitch__user left join identity on identity.id = twitch__user.identity_id where twitch__user.id = ?;", [userId]).then(result => {
                if (result.length > 0) {
                    let user = result[0];
                    resolve(this.#resolveUserObj(user));
                } else if (displayName !== null) {
                    con.query("insert into twitch__user (id, display_name) values (?, ?);", [userId, displayName], err => {
                        if (err) {reject(err);return;}

                        this.resolveById(userId).then(resolve).catch(reject);
                    });
                } else {
                    reject("Could not retrieve user");
                }
            }).catch(reject);
        });
    }

    resolveIdentity(twitchId, twitchName) {
        return new Promise((resolve, reject) => {
            con.query("select identity.id, identity.name from twitch__user as tu left join identity on identity.id = tu.identity_id where tu.id = ?;", twitchId, (err, res) => {
                if (err) {reject(err);return;}

                if (res.length > 0) {
                    if (res[0].id !== null) {
                        resolve(res[0]);
                    } else {
                        con.query("insert into identity (name) values (?);", [twitchName], (err, res) => {
                            if (err) {reject(err);return;}

                            let id = res.insertId;
                            con.query("update twitch__user set identity_id = ? where id = ?;", [id, twitchId]);
                            resolve({id: id, name: twitchName});
                        });
                    }
                } else {
                    reject("No record found.")
                }
            });
        });
    }

    resolveIdentityProfiles(identityId) {
        return new Promise((resolve, reject) => {
            con.query("select id, display_name, identity_id, profile_image_url, offline_image_url, description, view_count, follower_count, affiliation from twitch__user where identity_id = ?;", identityId, (err, res) => {
                if (err) {reject(err);return;}

                resolve(res);
            });
        });
    }

    getActiveChannels(twitchId) {
        return new Promise((resolve, reject) => {
            con.query("SELECT streamer_id, twitch__user.identity_id, max(timesent) as last_active FROM `twitch__chat` join twitch__user on streamer_id = twitch__user.id WHERE user_id = ? group by streamer_id;", [twitchId], async (err, res) => {
                if (err) {reject(err);return;}

                let results = [];

                for (let i = 0; i < res.length; i++) {
                    let identity = await (new IdentityService()).resolveIdentity(res[i].identity_id);
                    identity.last_active = res[i].last_active;

                    results = [
                        ...results,
                        identity
                    ];
                }

                resolve(results);
            });
        })
    }

}

class DiscordUserService {
    resolveIdentityProfiles(identityId) {
        return new Promise((resolve, reject) => {
            con.query("select id, name, discriminator, avatar, identity_id from discord__user where identity_id = ?;", identityId, (err, res) => {
                if (err) {reject(err);return;}

                resolve(res);
            });
        });
    }

    resolveIdentity(discordId, discordName) {
        return new Promise(async (resolve, reject) => {
            con.query("select identity_id from discord__user where id = ?;", [discordId], (err, res) => {
                if (err) {reject(err);return;}

                let ids = new IdentityService();
                if (res.length > 0) {
                    ids.resolveIdentity(res[0].identity_id).then(resolve, reject);
                } else {
                    con.query("insert into identity (name) values (?);", [discordName], (err2, res2) => {
                        if (err2) {reject(err2);return;}

                        con.query("update discord__user set identity_id = ? where id = ?;", [res2.insertId, discordId], err3 => {
                            if (err3) {reject(err3);return;}

                            ids.resolveIdentity(res2.insertId).then(resolve, reject);
                        });
                    });
                }
            });
        });
    }

    revokeDiscordRole(userId, role) {
        return this.revokeDiscordRoles(userId, [role]);
    }

    revokeDiscordRoles(userId, roles) {
        return new Promise(async (resolve, reject) => {
            let guild = await global.client.discord.guilds.fetch(config.modsquad_discord);

            if (guild) {
                let guildMember = await guild.members.fetch(userId);
                
                if (guildMember) {
                    let realRoles = [];

                    roles.forEach(role => {
                        if (guildMember.roles.cache.has(role)) {
                            realRoles = [
                                ...realRoles,
                                role
                            ];
                        }
                    });
                    console.log("removing roles ", realRoles);
                    guildMember.roles.remove(realRoles).then(() => {resolve();}).catch(reject);
                } else {
                    reject("User not found in the Mod squad guild");
                }
            } else {
                reject("Mod squad guild not found!");
            }
        });
    }

    grantDiscordRole(userId, role) {
        return this.grantDiscordRoles(userId, [role]);
    }

    grantDiscordRoles(userId, roles) {
        return new Promise(async (resolve, reject) => {
            let guild = await global.client.discord.guilds.fetch(config.modsquad_discord);

            if (guild) {
                let guildMember = await guild.members.fetch(userId);
                
                if (guildMember) {
                    let realRoles = [];

                    roles.forEach(role => {
                        if (!guildMember.roles.cache.has(role)) {
                            realRoles = [
                                ...realRoles,
                                role
                            ];
                        }
                    });
                    console.log("adding roles ", realRoles);
                    guildMember.roles.add(realRoles).then(() => {resolve();}).catch(reject);
                } else {
                    reject("User not found in the Mod squad guild");
                }
            } else {
                reject("Mod squad guild not found!");
            }
        });
    }
}

module.exports = {
    SessionService: new SessionService(),
    IdentityService: new IdentityService(),
    TwitchUserService: new TwitchUserService(),
    DiscordUserService: new DiscordUserService(),
    TwitchAPI: api,
};