var {ByteArray} = require("binary");
var {MessageDigest, SecureRandom} = java.security;

exports.createSalt = function() {
    var salt = new ByteArray(8);
    var random = SecureRandom.getInstance("SHA1PRNG");
    random.nextBytes(salt);
    return salt;
};

exports.createDigest = function(pwd, salt) {
    var digest = MessageDigest.getInstance("SHA-256");
    digest.update(salt.toByteString());
    return ByteArray.wrap(digest.digest(pwd.toByteString()));
};
