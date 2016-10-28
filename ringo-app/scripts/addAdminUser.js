const system = require("system");
const strings = require("ringo/utils/strings");
const shell = require("ringo/shell");
const term = require("ringo/term");

const utils = require("../app/utils");
const store = require("../app/store");
const AdminUser = require("../app/models/adminuser");

// create tables if necessary, and app is not in production mode
if (require("ringo/engine").getRhinoEngine().getConfig().isReloading()) {
    if (typeof(store.syncTables) === "function") {
        store.syncTables();
    }
}

var main = function(args) {
    var username, password, passwordConfirm, email;
    while (!username) {
        username = shell.readln("Username: ").trim();
        if (username.length > 0) {
            if (AdminUser.exists(username)) {
                term.writeln(term.BOLD, "This username is already registered, please choose a different", term.RESET);
                username = null;
            }
        }
    }

    while (!password || (password !== passwordConfirm)) {
        password = shell.readln("Password: ", "*");
        passwordConfirm = shell.readln("Confirm password: ", "*");
        if (password !== passwordConfirm) {
            term.writeln(term.BOLD, "\nPasswords do not match, please try again.\n", term.RESET);
        }
    }

    email = shell.readln("Email: ");
    term.writeln("\nAn new account will be created:\n");
    term.writeln("  Username:", term.BOLD, username, term.RESET);
    term.writeln("  Email:", term.BOLD, email, term.RESET, "\n");

    var salt = utils.createSalt();
    var passwordHash = utils.createDigest(password, salt);
    var adminuser = AdminUser.create(username, strings.b64encode(passwordHash), strings.b64encode(salt), email);

    term.writeln(term.GREEN, "Successfully created the account '" + username + "'", term.RESET);
};

if (require.main == module.id) {
    system.exit(main(system.args.slice(1)));
}
