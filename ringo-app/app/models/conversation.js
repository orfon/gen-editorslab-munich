const store = require("../store");

const Conversation = module.exports = store.defineEntity("Conversation", {
    "table": "t_conversation",
    "id": {
        "column": "conv_id",
        "sequence": "conversation_id"
    },
    "properties": {
        "name": {
            "type": "string",
            "column": "conv_name",
            "nullable": false
        },
        "slug": {
            "type": "string",
            "column": "conv_slug",
            "nullable": false,
            "unique": true
        },
        "greeting": {
            "type": "string",
            "column": "conv_greeting",
            "length": 320,
            "nullable": false
        },
        "interactions": {
            "type": "collection",
            "query": "from Interaction where conversation = :id order by interactionSequencePosition asc"
        }
    }
});

Conversation.create = function(slug, name, greeting) {
    if (slug == null || name == null || greeting == null) {
        throw new Error("Invalid conversation creation!");
    }

    var conversation = new Conversation({
        "slug": slug,
        "name": name,
        "greeting": greeting
    });
    conversation.save();
    return conversation;
};

Conversation.getLatest = function() {
    let result = store.query("from Conversation order by id desc limit 1");
    return (result.length === 1 ? result[0] : null);
};

Conversation.getAll = function() {
    return store.query("from Conversation order by id desc");
};

Conversation.getCount = function() {
    return store.query("select count(id) from Conversation")[0];
};

Conversation.getPage = function(offset, limit) {
    return store.query("from Conversation order by id desc limit :limit offset :offset", {
        offset: offset || 0,
        limit: limit || 10
    });
};

Conversation.getAllSubmissions = function(conversation) {
    return store.query("from Submission where conversation = :id order by created desc", {
        id: conversation.id
    });
};

Conversation.getSubmissions = function(conversation, offset, limit) {
    return store.query("from Submission where conversation = :id order by created desc offset :offset limit :limit", {
        id: conversation.id,
        offset: offset || 0,
        limit: limit || 10
    });
};

Conversation.getSubmissionCount = function(conversation) {
    return store.query("select count(id) from Submission where conversation = :id", {
        id: conversation.id
    })[0];
};

Conversation.getBySlug = function(slug) {
    return store.query("from Conversation where slug = :slug ", {
        slug: slug
    })[0];
};

Conversation.prototype.toString = function() {
    return "[Conversation #" + this.id + " - slug: " + this.interactions + "]";
};

/**
 * Uses the internal `_key` property to compare users.
 */
Conversation.prototype.equals = function(conv) {
    return this._key.equals(conv._key);
};
