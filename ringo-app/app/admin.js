const XSSFWorkbook = org.apache.poi.xssf.usermodel.XSSFWorkbook;

const config = require("gestalt").load(module.resolve("../config/config.json"));
const log = require("ringo/logging").getLogger(module.id);
const response = require("ringo/jsgi/response");
const strings = require("ringo/utils/strings");
const dates = require("ringo/utils/dates");

const {createDigest} = require("./utils");
const store = require("./store");
const {AdminUser, Conversation, Interaction} = require("./models/all");

const {Validator} = require("validator");
const {Reinhardt} = require("reinhardt");
const reinhardt = new Reinhardt({
    loader: module.resolve("../templates/")
});

const isAdmin = function(request) {
    return request.session && request.session.data && request.session.data.isAdmin === true;
};

const getCurrentUser = function(request) {
    if(isAdmin(request)) {
        return AdminUser.getByName(request.session.data.name);
    }

    return null;
};

const {Application} = require("stick");
const app = exports.app = new Application();
app.configure("session", "params", "route");

app.get("/", function(req) {
    if (!isAdmin(req)) {
        // for security to purge all old data
        req.session.invalidate();
        return response.html(reinhardt.getTemplate("admin/signin.html").render({}));
    }

    if (config.get("server:https:port") && req.scheme === "http") {
        return response.redirect(config.get("site:baseUrl"));
    }

    return response.html(reinhardt.getTemplate("admin/index.html").render({}));
});

app.get("/signout", function(req) {
    req.session.invalidate();
    return response.redirect("/admin/");
});

app.post("/signin", function(req) {

    if (req.postParams && req.postParams.username && req.postParams.password) {
        let username = req.postParams.username.trim();
        let password = req.postParams.password;

        let user = AdminUser.getByName(username);
        if (user != null) {
            var passwordHash = strings.b64encode(createDigest(password, strings.b64decode(user.salt, "raw")));

            if (user.authenticate(passwordHash)) {
                req.session.data.isAdmin = true;
                req.session.data.name = user.name;
                return response.redirect("/admin/");
            }
        }
    }

    return response.html(reinhardt.getTemplate("admin/signin.html").render({
        "message": "Could not authenticate user!"
    }));
});

app.get("/submissions", function(req) {
    if (!isAdmin(req)) {
        return response.redirect("/admin/");
    }

    if (config.get("server:https:port") && req.scheme === "http") {
        return response.redirect(config.get("site:baseUrl"));
    }

    const PER_PAGE = 5;
    const count = Conversation.getCount();
    const MAX_PAGE = Math.ceil(count / PER_PAGE) - 1;

    const validator = new Validator(req.queryParams);
    validator.validate("page")
        .isDefined("page not defined")
        .isInt("Invalid page!")
        .toInt().greaterThan(0, "page must be greater than 0!").lessThan(MAX_PAGE + 1);

    const CUR_PAGE = validator.hasFailures() ? 0 : validator.getValue("page");

    let offset = PER_PAGE * CUR_PAGE;
    let pagedConversations = Conversation.getPage(offset, PER_PAGE);

    pagedConversations = pagedConversations.map(function(conversation) {
        let clone = {
            "slug": conversation.slug,
            "name": conversation.name,
            "greeting": conversation.greeting
        };

        // refresh data
        conversation.interactions.invalidate();

        clone.interactions = conversation.interactions.map(function(interaction) {
            return {
                "fieldName": interaction.fieldName,
                "type": interaction.type,
                "interactionSequencePosition": interaction.interactionSequencePosition,
                "message": interaction.message
            };
        });

        clone.submissionCount = Conversation.getSubmissionCount(conversation);
        clone.submissions = Conversation.getSubmissions(conversation, 0, 5).map(function(submission) {
            return {
                "created": submission.created,
                "sender": submission.sender,
                "data": submission.data
            };
        });

        return clone;
    });

    const ctx = {
        conversations: pagedConversations
    };

    if (CUR_PAGE >= 1) {
        ctx.prev = CUR_PAGE - 1;
    }

    if (CUR_PAGE < MAX_PAGE) {
        ctx.next = CUR_PAGE + 1;
    }

    return response.html(reinhardt.getTemplate("admin/submissions.html").render(ctx));
});

app.get("/addConversation", function(req) {
    if (!isAdmin(req)) {
        return response.redirect("/admin/");
    }

    if (config.get("server:https:port") && req.scheme === "http") {
        return response.redirect(config.get("site:baseUrl"));
    }

    return response.html(reinhardt.getTemplate("admin/conv-new.html").render({}));
});

app.post("/addConversation", function(req) {
    if (!isAdmin(req)) {
        return response.redirect("/admin/");
    }

    if (config.get("server:https:port") && req.scheme === "http") {
        return response.redirect(config.get("site:baseUrl"));
    }

    const validator = new Validator(req.postParams);
    validator.validate("name", true)
        .isDefined("Name is missing!")
        .minLength(3, "Name is too short!")
        .maxLength(20, "Name is too long!");

    validator.validate("greeting", true)
        .isDefined("Greeting text is missing!")
        .maxLength(320, "Greeting text is too long!");

    validator.validate("interactions")
        .isDefined("Interactions missing!")
        .passes(function(interactions) {
            for (let field in interactions) {
                let iData = interactions[field];

                console.log(iData.toSource())

                // quick reply needs two options
                if (iData.type === "quick" && iData.message.trim().split("\n").length < 2) {
                    return false;
                }

                // emtpy messages are not allowed
                if ((iData.fieldName || "").trim().length < 1 || (iData.message || "").trim().length < 1) {
                    return false
                }

                if (Number.isNaN(parseInt(iData.interactionSequencePosition, 10))) {
                    return false;
                }

                return true;
            }
        }, "Invalid interactions provided!");

    if (validator.hasFailures()) {
        log.error("Invalid form submit!");
        return response.text(JSON.stringify(validator.getMessages(), null, 2)).bad();
    }

    let slug = String(Math.ceil(1000000000 * Math.random())) + validator.getValue("name").toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');

    if (Conversation.getBySlug(slug) != null) {
        return response.text("Conversation for slug " + slug + " already exists.").bad();
    }

    store.beginTransaction();
    try {
        const conversation = Conversation.create(slug, validator.getValue("name"), validator.getValue("greeting"));
        for (let field in req.postParams.interactions) {
            let iData = req.postParams.interactions[field];

            Interaction.create(conversation, iData.fieldName, iData.type, parseInt(iData.interactionSequencePosition, 10), iData.message);
        }
        conversation.interactions.invalidate();
        store.commitTransaction();
    } catch (e) {
        store.abortTransaction();
        log.error("Aborted transaction! Error: " + e);
        return response.text("Internal Server Error.").error();
    }

    return response.redirect("/admin/");
});

app.get("/download", function(req) {
    if (!isAdmin(req) || (config.get("server:https:port") && req.scheme === "http")) {
        return response.redirect("/admin/");
    }

    if (req.queryParams.conversation == null) {
        return response.bad().text("No parameter given.");
    }

    const conversation = Conversation.getBySlug(req.queryParams.conversation);
    if (conversation == null) {
        return response.notFound().text("Conversation not found.");
    }

    let wb = new XSSFWorkbook();
    let createHelper = wb.getCreationHelper();
    let sheet = wb.createSheet("Coworker");

    // resize columns to fit data
    const BASE_CHAR_WIDTH = 256;

    // optimize the widths
    sheet.setColumnWidth(0, 18 * BASE_CHAR_WIDTH);  // created
    sheet.setColumnWidth(1, 18 * BASE_CHAR_WIDTH);  // sender

    // arbitrary columns
    for (let i = 0; i < conversation.interactions.length; i++) {
        sheet.setColumnWidth(i + 2, 25 * BASE_CHAR_WIDTH);
    }

    let headers = sheet.createRow(0);
    headers.createCell(0).setCellValue(createHelper.createRichTextString("created"));
    headers.createCell(1).setCellValue(createHelper.createRichTextString("sender id"));
    conversation.interactions.forEach(function(interaction, index) {
        headers.createCell(index + 2).setCellValue(createHelper.createRichTextString(interaction.fieldName));
    });

    const cal = new java.util.GregorianCalendar(java.util.TimeZone.getTimeZone("UTC"));
    const xlsDateFormat = createHelper.createDataFormat().getFormat("dd.MM.yyyy HH:mm:ss");

    Conversation.getAllSubmissions(conversation).forEach(function(submission, index) {
        let row = sheet.createRow(index + 1); // +1 => header is row 0

        // created
        let cell = row.createCell(0);
        let cellStyle = wb.createCellStyle();
        cal.setTime(submission.created);
        cell.setCellValue(cal);
        cellStyle.setDataFormat(xlsDateFormat);
        cell.setCellStyle(cellStyle);

        // sender
        row.createCell(1).setCellValue(submission.sender);

        // data fields
        submission.data.forEach(function(answer, index) {
            row.createCell(index + 2).setCellValue(createHelper.createRichTextString(String(answer)));
        });
    });

    let binOut = new java.io.ByteArrayOutputStream(4048);
    wb.write(binOut);
    let wrappedArray = ByteArray.wrap(binOut.toByteArray());
    binOut.close();

    return response.binary(wrappedArray, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").addHeaders({
        "Content-Disposition": "attachment; filename=\"" + conversation.slug + "-" + dates.format(new Date(), "yyyy-MM-dd") + ".xlsx\""
    });
});
