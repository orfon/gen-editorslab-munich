const log = require("ringo/logging").getLogger(module.id);

const STRING = java.lang.Class.forName("java.lang.String");
const {CacheManagerBuilder, ResourcePoolsBuilder, CacheConfigurationBuilder} = org.ehcache.config.builders;
const {EntryUnit, MemoryUnit} = org.ehcache.config.units;
const {Expirations, Duration} = org.ehcache.expiry;
const {TimeUnit} = java.util.concurrent;

exports.buildCacheManager = function(cacheName, cacheFile, heapEntries, diskSize, ttiExpiry) {
    const cacheTiers = ResourcePoolsBuilder.newResourcePoolsBuilder()
        .heap(heapEntries, EntryUnit.ENTRIES)
        .disk(diskSize, MemoryUnit.MB, true);

    const cacheConfiguration = CacheConfigurationBuilder.newCacheConfigurationBuilder(STRING, STRING, cacheTiers)
        .withExpiry(Expirations.timeToIdleExpiration(Duration.of(ttiExpiry, TimeUnit.MINUTES)));

    const cacheManagerBuilder = CacheManagerBuilder.newCacheManagerBuilder()
        .with(CacheManagerBuilder.persistence(cacheFile))
        .withCache(cacheName, cacheConfiguration);

    // builds the cache manager and returns the associated cache
    return cacheManagerBuilder.build(true);
};

exports.getCache = function(cacheManager, name) {
    return cacheManager.getCache(name, STRING, STRING);
};

exports.remove = function(cache, key) {
    log.debug("Removing {} from cache ...", key);
    return cache.remove(new java.lang.String(key));
};

exports.put = function(cache, key, value) {
    log.debug("Putting {} / {} into cache ...", key, value);
    return cache.put(new java.lang.String(key), new java.lang.String(value));
};

exports.get = function(cache, key) {
    const val = cache.get(new java.lang.String(key));
    log.debug("Getting {} / {} from cache ...", key, val);
    return val;
};
