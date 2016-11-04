const fs = require("fs");
const strings = require("ringo/utils/strings");

const logging = require("ringo/logging");
logging.setConfig(getResource(module.resolve("./config/log4j.properties")));
const log = logging.getLogger(module.id);

const config = require("gestalt").load(module.resolve("./config/config.json"));

// the HTTP server itself
const httpServer = require("httpserver");
var server = null;

const stop = exports.stop = function() {
    if (server !== null) {
        server.stop();
    }
};

const start = exports.start = function() {
    // fixme implement quick menu and start info for bot

    log.info("Starting webserver for botox");
    server = httpServer.build()
        .serveApplication("/", module.resolve("./app/routes"), {
            "virtualHosts": config.get("vhosts")
        })
        .http({
            "host": config.get("server:http:host"),
            "port": config.get("server:http:port")
        });

    if (config.get("server:https:port")) {
        server.https({
            "host": config.get("server:https:host"),
            "port": config.get("server:https:port"),
            "keyStore": config.get("server:https:keyStore"),
            "keyStorePassword": config.get("server:https:keyStorePassword"),
            "keyManagerPassword": config.get("server:https:keyManagerPassword"),
            "includeCipherSuites": config.get("server:https:includeCipherSuites")
        })
    }

    server.start();
};

if (require.main === module) {
    // add all jar files in jars directory to classpath
    getRepository(module.resolve("./jars/")).getResources().filter(function(r) {
        return strings.endsWith(r.name, ".jar");
    }).forEach(function(file) {
        log.info("Added JAR to classpath:", file);
        addToClasspath(file);
    });

    // relational database binding
    const store = require("./app/store");
    if (typeof(store.syncTables) === "function") {
        // require models to register them before the table sync
        const models = require("./app/models/all");
        store.syncTables();
    }

    start();
}
