const store = require("../store");

const Interaction = module.exports = store.defineEntity("Interaction", {
    "table": "t_interaction",
    "id": {
        "column": "int_id",
        "sequence": "interaction_id"
    },
    "properties": {
        "conversation": {
            "type": "object",
            "entity": "Conversation",
            "column": "int_f_conversation",
            "foreignProperty": "id",
            "nullable": false
        },
        "fieldName": {
            "type": "string",
            "column": "int_fieldname",
            "nullable": false
        },
        "type": {
            "type": "string",
            "column": "int_type",
            "nullable": false
        },
        "interactionSequencePosition": {
            "type": "integer",
            "column": "int_position",
            "nullable": false
        },
        "message": {
            "type": "string",
            "column": "int_message",
            "nullable": false
        }
    }
});

Interaction.create = function(conversation, fieldName, type, interactionSequencePosition, message) {
    if (conversation == null || fieldName == null || type == null || interactionSequencePosition == null || message == null || !Number.isInteger(interactionSequencePosition)) {
        throw new Error("Invalid interaction creation!");
    }

    var interaction = new Interaction({
        "conversation": conversation,
        "fieldName": fieldName,
        "type": type,
        "interactionSequencePosition": interactionSequencePosition,
        "message": message
    });
    interaction.save();
    return interaction;
};
