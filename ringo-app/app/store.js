const config = require("gestalt").load(module.resolve("../config/config.json"));
const log = require("ringo/logging").getLogger(module.id);
const {Store, Cache} = require("ringo-sqlstore");

const entityCache = module.singleton("entitycache", function() {
    return new Cache(config.get("db:cacheSize"));
});

const connectionPool = module.singleton("connectionpool", function() {
    log.info("Instantiating connection pool singleton:", config.get("db:connection:url"));
    return Store.initConnectionPool(config.get("db:connection"));
});

const store = module.exports = new Store(connectionPool);
store.setEntityCache(entityCache);
