const con = require("../../database");

const Identity = require("../Identity");
const TwitchUser = require("./TwitchUser");

const Cache = require("../Cache/Cache");
const Assumption = require("../Assumption");
const AssumedTwitchUser = require("./AssumedTwitchUser");

const config = require("../../config.json");

const {ApiClient} = require("twitch");
const {ClientCredentialsAuthProvider} = require("twitch-auth");

const authProvider = new ClientCredentialsAuthProvider(config.twitch.client_id, config.twitch.client_secret);
const api = new ApiClient({ authProvider });

/**
 * Utility class for Twitch services
 */
class Twitch {

    /**
     * Direct access to Twitch's API suite
     * 
     * @type {ApiClient}
     */
    Direct = api;

    /**
     * Twitch user cache (ID)
     * 
     * @type {Cache}
     */
    userCache = new Cache();

    /**
     * Requests a user directly from the Twitch Helix API
     * This method should NEVER be used externally as it can take a substantial amount of time to request and WILL overwrite other data.
     * @param {string} id 
     * @returns {Promise<TwitchUser>}
     */
    getUserByIdByForce(id) {
        return new Promise(async (resolve, reject) => {
            let helixUser = await api.helix.users.getUserById(id);

            if (helixUser) {
                let user = new TwitchUser(helixUser.id, null, helixUser.displayName, null, helixUser.profilePictureUrl, helixUser.offlinePlaceholderUrl, helixUser.description, helixUser.views, null, null, (helixUser.broadcasterType === "" ? null : helixUser.broadcasterType), null);
                await user.refreshFollowers();
                user.post();

                resolve(user);
            } else {
                reject("User not found!");
            }
        });
    }

    /**
     * Gets a user based on a Twitch user ID.
     * @param {number} id 
     * @param {boolean} bypassCache
     * @param {boolean} requestIfUnavailable
     * 
     * @returns {Promise<TwitchUser>}
     */
    getUserById(id, bypassCache = false, requestIfUnavailable = false) {
        return this.userCache.get(id, (resolve, reject) => {
            con.query("select twitch__user.*, identity.name as identity_name from twitch__user left join identity on twitch__user.identity_id = identity.id where twitch__user.id = ?;", [id], (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    if (res.length > 0) {
                        let row = res[0];
                        resolve(new TwitchUser(
                            row.id,
                            row.identity_id === null ? null : new Identity(row.identity_id, row.identity_name),
                            row.display_name,
                            row.email,
                            row.profile_image_url,
                            row.offline_image_url,
                            row.description,
                            row.view_count,
                            row.follower_count,
                            row.last_updated,
                            row.affiliation,
                            row.moderator_checked,
                        ));
                    } else {
                        if (requestIfUnavailable) {
                            this.getUserByIdByForce(id).then(resolve, reject);
                        } else {
                            reject("User not found!");
                        }
                    }
                }
            });
        }, bypassCache);
    }

    /**
     * Requests a user directly from the Twitch Helix API
     * This method should NEVER be used externally as it can take a substantial amount of time to request and WILL overwrite other data.
     * @param {string} display_name 
     * @returns {Promise<AssumedTwitchUser[]>}
     */
    getUserByNameByForce(display_name) {
        return new Promise(async (resolve, reject) => {
            let helixUser = await api.helix.users.getUserByName(display_name);

            if (helixUser) {
                let user = new TwitchUser(helixUser.id, null, helixUser.displayName, null, helixUser.profilePictureUrl, helixUser.offlinePlaceholderUrl, helixUser.description, helixUser.views, null, null, (helixUser.broadcasterType === "" ? null : helixUser.broadcasterType), null);
                await user.refreshFollowers();
                user.post();

                user = new AssumedTwitchUser(user, [new Assumption("display_name", display_name, user.display_name)])

                resolve([user]);
            } else {
                reject("No users were found!");
            }
        });
    }

    /**
     * Gets a user based on a Twitch name
     * @param {string} display_name
     * @param {boolean} requestIfUnavailable default false
     * @returns {Promise<AssumedTwitchUser[]>}
     */
    getUserByName(display_name, requestIfUnavailable = false) {
        return new Promise((resolve, reject) => {
            con.query("select id from twitch__username where display_name = ?;", [display_name], async (err, res) => {
                if (!err) {
                    if (res.length > 0) {
                        let result = [];
                        for (let i = 0; i < res.length; i++) {
                            let row = res[i];
                            try {
                                let user = await this.getUserById(row.id);
                                result = [
                                    ...result,
                                    new AssumedTwitchUser(user, [new Assumption("display_name", display_name, user.display_name)]),
                                ];
                            } catch (e) {
                                console.error(e);
                            }
                        }
                        resolve(result);
                    } else {
                        if (requestIfUnavailable) {
                            this.getUserByNameByForce(display_name).then(resolve, reject);
                        } else
                            reject("No users were found!");
                    }
                } else {
                    reject(err);
                }
            });
        });
    }

    /**
     * Gets a list of users based on an identity
     * @param {number} id
     * @returns {Promise<TwitchUser[]>}
     */
    getUsersByIdentity(id) {
        return new Promise((resolve, reject) => {
            con.query("select id from twitch__user where identity_id = ?;", [id], async (err, res) => {
                if (!err) {
                    let result = [];
                    for (let i = 0; i < res.length; i++) {
                        try {
                            let user = await this.getUserById(res[i].id);
                            result = [
                                ...result,
                                user,
                            ];
                        } catch (e) {
                            console.error(e);
                        }
                    }
                    resolve(result);
                } else {
                    reject(err);
                }
            });
        });
    }
}

module.exports = Twitch;