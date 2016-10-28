const config = require("gestalt").load(module.resolve("../config/config.json"));

const log = require("ringo/logging").getLogger(module.id);
const response = require("ringo/jsgi/response");

const {Reinhardt} = require("reinhardt");
const reinhardt = new Reinhardt({
    loader: module.resolve("../templates/")
});

const {Conversation} = require("./models/all");
const {Worker} = require("ringo/worker");
const fbmUtils = require("fbmessenger/utils");

const {Application} = require("stick");
const app = exports.app = new Application();
app.configure("gzip", "etag", "static", "params", "route", "mount");

app.static(module.resolve("../../static/dist/assets/"), "index.html", "/static/", {
    dotfiles: "deny"
});

app.mount("/admin", module.resolve("./admin"));

app.get("/", function (req) {
    if (config.get("server:https:port")) {
        if (req.scheme === "http" && config.get("server:https:hsts") === true) {
            return response.addHeaders({
                "X-Content-Type-Options": "nosniff",
                "X-XSS-Protection": "1; mode=block",
                "X-Frame-Options": "SAMEORIGIN",
                "Strict-Transport-Security": "max-age=172800; includeSubDomains; preload"
            }).redirect(config.get("site:baseUrl"));
        }
    }

    return response.html(reinhardt.getTemplate("index.html").render({
        conversations: Conversation.getAll(),
        messenger: config.get("messenger")
    }));
});

/**********************************************************************************************************************/
/***  MESSENGER                                                                                                     ***/
/**********************************************************************************************************************/

// Facebook Messenger callback verification endpoint
log.info(java.lang.Thread.currentThread().getName(), "- binding GET", config.get("messenger:callbackPath"), "for Messenger ...");
app.get(config.get("messenger:callbackPath"), function(req) {
    if (req.params["hub.verify_token"] === config.get("messenger:verifyToken")) {
        log.info("Successful challenge!");
        return response.text(req.params["hub.challenge"]);
    }

    log.error("Failed validation. Make sure the validation tokens match.");
    return response.setStatus(403).text("Failed validation. Make sure the validation tokens match.");
});

// Processing the requests
log.info(java.lang.Thread.currentThread().getName(), " binding POST", config.get("messenger:callbackPath"), "for Messenger ...");
app.post(config.get("messenger:callbackPath"), function(req) {
    if (req.postParams !== null && fbmUtils.isMessagingCallback(req.postParams)) {
        try {
            const messaging = fbmUtils.getMessagingForPage(req.postParams, config.get("messenger:pageId"));
            processMessages(messaging.filter(function(message) {
                return fbmUtils.isMessage(message) || fbmUtils.isPostback(message) || fbmUtils.isAuthentication(message);
            }));
        } catch (e) {
            log.error("Processing error!", e);
        }
    } else {
        log.error("Invalid request", req.toSource());
    }

    return response.json({
        "timestamp": Date.now()
    }).ok();
});

const processMessages = function(messages) {
    const botoxWorker = new Worker(module.resolve("./botox"));

    botoxWorker.onerror = function(event) {
        log.error("Worker error: ", event.data);
    };

    messages.forEach(function(message) {
        const senderId = message.sender.id;

        // validate the sender id before processing
        if (!fbmUtils.isValidFacebookId(senderId)) {
            log.warn("Invalid sender id in the following message:", JSON.stringify(message, null, 2));
            return;
        }

        // async processing for each message
        botoxWorker.postMessage(message);
    });
};
