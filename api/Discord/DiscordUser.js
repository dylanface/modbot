const con = require("../../database");

const User = require("../User");
const Identity = require("../Identity");

const DISCORD_CDN = "https://cdn.discordapp.com/";

/**
 * The class for a specific Discord user
 * @extends User
 */
class DiscordUser extends User {

    /**
     * Discord username
     * @type {string}
     */
    name;

    /**
     * Discord discriminator tag
     * @type {number}
     */
    discriminator;

    /**
     * Avatar string, used to generate a Discord avatar image URL
     * @type {?string}
     */
    avatar;
    
    /**
     * Avatar URL
     * @type {string}
     */
    avatar_url;

    /**
     * Constructor for a Discord user
     * @param {number} id 
     * @param {Identity} identity 
     * @param {string} name 
     * @param {number} discriminator 
     * @param {?string} avatar 
     */
    constructor(id, identity, name, discriminator, avatar) {
        super(id, identity);

        this.name = name;
        this.discriminator = discriminator;
        this.avatar = avatar;

        this.avatar_url = this.getAvatar();
    };

    /**
     * Generates the Discord avatar for this user.
     * 
     * @returns {string} Avatar URL
     */
    getAvatar() {
        if (this.avatar) {
            return DISCORD_CDN + `avatars/${this.id}/${this.avatar}.png`;
        } else {
            return DISCORD_CDN + `embed/avatars/${this.discriminator % 5}.png`;
        }
    }

    /**
     * Gets TMS short link to user's page
     * @returns {string}
     */
    getShortlink() {
        if (this.identity?.id) {
            return "https://tms.to/i/" + this.identity.id;
        } else {
            return "https://tms.to/d/" + this.id;
        }
    }

    /**
     * Updates or creates the user with the information in this Object
     * 
     * @returns {Promise<DiscordUser>}
     */
    post() {
        return new Promise(async (resolve, reject) => {
            con.query("insert into discord__user (id, name, discriminator, avatar, identity_id) values (?, ?, ?, ?, ?) on duplicate key update name = ?, discriminator = ?, avatar = ?, identity_id = ?;", [
                this.id,
                this.name,
                this.discriminator,
                this.avatar,
                this.identity?.id,
                this.name,
                this.discriminator,
                this.avatar,
                this.identity?.id
            ], err => {
                if (err) {
                    reject(err);
                } else {
                    resolve(this);
                    global.api.Discord.userCache.remove(this.id);
                }
            });
        })
    }
    
}

module.exports = DiscordUser;