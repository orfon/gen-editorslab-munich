const store = require("../store");

const AdminUser = module.exports = store.defineEntity("AdminUser", {
    "table": "t_adminuser",
    "id": {
        "column": "usr_id",
        "sequence": "user_id"
    },
    "properties": {
        "name": {
            "type": "string",
            "column": "usr_name",
            "length": 100
        },
        "password": {
            "type": "string",
            "column": "usr_password",
            "length": 255
        },
        "salt": {
            "type": "string",
            "column": "usr_salt",
            "length": 255
        },
        "email": {
            "type": "string",
            "column": "usr_email",
            "length": 255
        }
    }
});

AdminUser.create = function(username, password, salt, email) {
    var user = new AdminUser({
        "name": username,
        "password": password,
        "salt": salt,
        "email": email
    });
    user.save();
    return user;
};

AdminUser.getByName = function(name) {
    return store.query("from AdminUser as usr where usr.name = :name", {
            "name": name
        })[0] || null;
};

AdminUser.getByEmail = function(email) {
    return store.query("from AdminUser as usr where usr.email = :email", {
            "email": email
        })[0] || null;
};

AdminUser.exists = function(name) {
    return AdminUser.getByName(name) !== null;
};

AdminUser.prototype.authenticate = function(b64digest) {
    return b64digest === this.password;
};

AdminUser.prototype.toString = function() {
    return "[AdminUser " + this.name + "]";
};

AdminUser.prototype.equals = function(user) {
    return this._key.equals(user._key);
};
