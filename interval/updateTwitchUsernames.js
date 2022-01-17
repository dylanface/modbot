const con = require("../database");

module.exports = () => {
    con.query("select twitch__user.id, twitch__user.display_name from twitch__user left join twitch__username on twitch__username.id = twitch__user.id where twitch__username.id is null;", (err, res) => {
        if (err) {console.error(err);return;}

        res.forEach(user => {
            con.query("update twitch__username set last_seen = now() where id = ? and last_seen is null;", [user.id], err => {
                if (err) console.error(err);

                con.query("insert into twitch__username (id, display_name, first_seen) values (?, ?, now());", [user.id, user.display_name]);
            });
        })
    });
};
