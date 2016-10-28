const store = require("../store");

const Submission = module.exports = store.defineEntity("Submission", {
    "table": "t_submission",
    "id": {
        "column": "sub_id",
        "sequence": "submission_id"
    },
    "properties": {
        "conversation": {
            "type": "object",
            "entity": "Conversation",
            "column": "sub_f_conversation",
            "foreignProperty": "id",
            "nullable": false
        },
        "created": {
            "type": "date",
            "column": "sub_created",
            "nullable": false
        },
        "sender": {
            "type": "string",
            "column": "sub_sender",
            "nullable": false
        },
        "data": {
            "type": "json",
            "column": "sub_data",
            "nullable": false
        }
    }
});

Submission.create = function(conversation, created, sender, data) {
    if (conversation == null || created == null || sender == null || data == null) {
        throw new Error("Invalid submission creation!");
    }

    var submission = new Submission({
        "conversation": conversation,
        "created": created,
        "sender": sender,
        "data": data
    });
    submission.save();
    return submission;
};


Submission.prototype.toString = function() {
    return "[Submission #" + this.id + " - conversation: " + this.conversation + "]";
};

/**
 * Uses the internal `_key` property to compare users.
 */
Submission.prototype.equals = function(sub) {
    return this._key.equals(sub._key);
};
