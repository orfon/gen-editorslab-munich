const log = require("ringo/logging").getLogger(module.id);
const config = require("gestalt").load(module.resolve("../config/config.json"));

const strings = require("ringo/utils/strings");
const {FBMessenger, MultipartStream, GraphApiError} = require("fbmessenger");
const fbmUtils = require("fbmessenger/utils");
const bot = new FBMessenger(config.get("messenger:pageToken"));

const {State, getState} = require("./statemanagement");
const {Conversation, Submission} = require("./models/all");

const onmessage = function(event) {
    const message = event.data;

    log.info(message.toSource());

    let state;
    let wasAuthRequest = false;

    if (fbmUtils.isAuthentication(message)) {
        let slug = message.optin.ref;
        let conversation = Conversation.getBySlug(slug);
        if (conversation == null) {
            log.error("Conversation for slug {} does not exist!", slug);
            return;
        }

        state = getState(message.sender.id);
        if (state == null) {
            state = new State(message.sender.id, JSON.stringify({ slug: conversation.slug, step: 0, answers: [] }));
        }
        wasAuthRequest = true;
    }

    if (fbmUtils.isPostback(message)) {
        let payload;

        try {
            payload = JSON.parse(message.postback.payload);
        } catch (e) {
            log.error("[messenger] Invalid payload in postback!", e);
            return;
        }

        if (payload.event === "user_start") {
            let conversationToStart = Conversation.getBySlug(payload.slug);
            if (conversationToStart == null) {
                bot.sendTextMessage(message.sender.id, "Sorry, no active survey found for this name \uD83D\uDE1E")
                return;
            } else {
                state = new State(message.sender.id, JSON.stringify({ slug: conversationToStart.slug, step: 0, answers: [] }));
                processState(bot, state, message, conversationToStart);
            }
        }
    } else if (wasAuthRequest || fbmUtils.isMessage(message)) {
        if (state == null) {
            state = getState(message.sender.id);
        }

        if (message.message && message.message.text) {
            const tlow = message.message.text.toLowerCase();
            if (tlow === "help" || tlow === "hilfe") {
                bot.sendTextMessage(message.sender.id, "This is an interactive survey bot made by Team ORF for the EditorsLab in Munich. Just drop a line to participate. Use 'stop' to stop any survey.");
                return;
            } else if (tlow === "stop" || tlow === "reset" || tlow === "abbrechen") {
                bot.sendTextMessage(message.sender.id, "You said stop, I will respect that and you can start from the beginning.");
                if (state != null) {
                    state.delete();
                }
                return;
            }
        }

        // No state found ...
        if (state == null) {
            let latestConversation = Conversation.getLatest();
            if (latestConversation == null) {
                bot.sendTextMessage(message.sender.id, "Sorry, no active surveys \uD83D\uDE1E");
            } else {
                // fixme implement a search or display at least more conversations
                bot.sendButtonTemplate(message.sender.id, "Do you want to participate in this survey?", [
                    {
                        "type": "postback",
                        "title": latestConversation.name,
                        "payload": JSON.stringify({ event: "user_start", slug: latestConversation.slug })
                    }
                ]);
            }
        } else {
            processState(bot, state, message);
        }
    }
};

const processState = function(bot, state, message, conversation) {
    let stateConfig = state.getAsObject();

    if (conversation === undefined) {
        conversation = Conversation.getBySlug(stateConfig.slug);
        if (conversation == null) {
            state.delete();
            log.error("Invalid state! No conversation found for slug {}", stateConfig.slug);
            return;
        }
    }

    // store result for previous step
    if (stateConfig.step > 0) {
        let answeredInteraction = conversation.interactions.get(stateConfig.step - 1);
        let answerText;

        if (message.message.text) {
            answerText = message.message.text.trim();
        } else if (message.message.attachments && message.message.attachments.length == 1) {
            if (message.message.attachments[0].type === "location") {
                answerText = message.message.attachments[0].payload.coordinates.lat + "," + message.message.attachments[0].payload.coordinates.long;
            } else if (message.message.attachments[0].payload.url) {
                answerText = message.message.attachments[0].payload.url;
            } else {
                log.error("Invalid message attachment!\n" + JSON.stringify(message, null, 2));
            }
        } else {
            log.error("Invalid message!\n" + JSON.stringify(message, null, 2));
        }

        stateConfig.answers.push(answerText);
    }

    if (stateConfig.step >= conversation.interactions.length) {
        state.delete();

        if (stateConfig.step > conversation.interactions.length) {
            log.error("Invalid step {} for conversation {}!", stateConfig.step, conversation);
        } else {
            let submission = Submission.create(conversation, new Date(), message.sender.id, stateConfig.answers);
            submission.save();
            log.info("Stored submission {} into database.", submission);

            bot.sendTextMessage(message.sender.id, "Thank you for your participation \uD83D\uDC4D");
        }

        return;
    }

    if (stateConfig.step === 0) {
        bot.sendTextMessage(message.sender.id, conversation.greeting);
    }

    let interaction = conversation.interactions.get(stateConfig.step);
    switch (interaction.type) {
        case "text":
            bot.sendTextMessage(message.sender.id, interaction.message);
            break;
        case "quick":
            let replies = interaction.message.split("\n");
            if (replies.length >= 2) {
                bot.sendQuickReplies(message.sender.id, replies[0], replies.slice(1).map(function(text) {
                    return {
                        "content_type": "text",
                        "title": text,
                        "payload": JSON.stringify({
                            event: "quickreply",
                            fieldName: interaction.fieldName,
                            value: text
                        })
                    };
                }));
            }
            break;
        case "location":
            bot.sendQuickReplies(message.sender.id, interaction.message, [{
                "content_type": "location"
            }]);
            break;
        case "image":
            console.log("URL", interaction.message);
            bot.sendImageAttachment(message.sender.id, interaction.message);
            break;
        case "audio":
            bot.sendAudioAttachment(message.sender.id, interaction.message);
            break;
        case "video":
            bot.sendVideoAttachment(message.sender.id, interaction.message);
            break;
        case "file":
            bot.sendFileAttachment(message.sender.id, interaction.message);
            break;
    }

    stateConfig.step++;
    state.setState(JSON.stringify(stateConfig));
};
