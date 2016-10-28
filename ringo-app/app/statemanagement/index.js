const log = require("ringo/logging").getLogger(module.id);
const {buildCacheManager, getCache, remove, put, get} = require("./cache");
const config = require("gestalt").load(module.resolve("../../config/config.json"));

const cacheManager = module.singleton("cacheManager", function() {
    let cm = buildCacheManager(config.get("cache:name"), config.get("cache:persistenceFile"), config.get("cache:heapEntries"), config.get("cache:persistenceFileSize"), config.get("cache:ttiExpiry"));
    require("ringo/engine").addShutdownHook(function () {
        if (cm.getStatus() !== org.ehcache.Status.UNINITIALIZED) {
            log.info("Closing cache manager, status is {}", cm.getStatus());
            cm.close();
            log.info("Closed cache manager, status is {}", cm.getStatus());
        } else {
            log.error("Cache already in state {}", cm.getStatus());
        }
    }, true);

    return cm;
});

const cache = getCache(cacheManager, config.get("cache:name"));

const State = exports.State = function(userId, state) {
    if (userId == null) {
        throw new Error("User ID missing!");
    }

    if (state == null) {
        throw new Error("State missing");
    }

    const uid = userId;
    put(cache, uid, state);

    this.getUID = function() {
        return uid;
    };

    this.getState = function() {
        return get(cache, uid);
    };

    this.getAsObject = function() {
        return JSON.parse(this.getState());
    };

    this.setState = sync(function(newState) {
        put(cache, uid, newState);
    }, this);

    this.delete = sync(function() {
        remove(cache, uid);
    }, this);
};

const getState = exports.getState = function(userId) {
    if (userId == null) {
        throw new Error("User ID missing!");
    }

    const state = get(cache, userId);

    if (state != null) {
        return new State(userId, state);
    }

    return null;
};
