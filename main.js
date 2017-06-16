var https = require("https");

var WebSocket = require("ws");
var RTM = require("satori-sdk-js"); // TODO: Deprecated

// Credentials file
var credentials = require("./credentials.json");

// Satori.com publish keys
var roleSecretKey = credentials.satori.secret;
var appkey = credentials.satori.key;

var endpoint = "wss://open-data.api.satori.com";
var role = "meetup";
var channel = "meetup";

var roleSecretProvider = RTM.roleSecretAuthProvider(role, roleSecretKey);

var rtm = new RTM(endpoint, appkey, {
    authProvider: roleSecretProvider,
});

var subscription = rtm.subscribe(channel, RTM.SubscriptionMode.SIMPLE);

var subscribed = false;
subscription.on("enter-subscribed", function() {
    if (!subscribed) {
        subscribed = true;
        events();
        comments();
        photos();
        open_events();
        open_venues();
    }
});

rtm.start();

function publish(message) {
    rtm.publish("meetup", message);
}

// Subscribe to rsvps
function events() {
    var ws = new WebSocket("ws://stream.meetup.com/2/rsvps");
    ws.on("message", function(data) {
        try {
            publish({
                type: "rsvp",
                rsvp: typeof data == "string" ? JSON.parse(data) : data
            });
        } catch (e) {
        }
    });
    ws.on("close", events);
}

// Subscribe to comments
function comments() {
    var ws = new WebSocket("ws://stream.meetup.com/2/event_comments");
    ws.on("message", function(data) {
        try {
            publish({
                type: "comment",
                comment: typeof data == "string" ? JSON.parse(data) : data
            });
        } catch (e) {
        }
    });
    ws.on("close", comments);
}

// Subscribe to photos
function photos() {
    var ws = new WebSocket("ws://stream.meetup.com/2/photos");
    ws.on("message", function(data) {
        try {
            publish({
                type: "photo",
                photo: typeof data == "string" ? JSON.parse(data) : data
            });
        } catch (e) {
        }
    });
    ws.on("close", photos);
}

// Long-poll open_events (no WebSocket support)
function poll(url, type) {
    var request = https.get(url, (res) => {
        res.setEncoding("utf8");
        let data = "";
        res.on("data", (chunk) => {
            // Append data byte per byte, to eventually find a valid JSON file
            for (var i = 0; i < chunk.length; i++) {
                data += chunk[i];
                try {
                    var p = {
                        type: type
                    };
                    p[type] = typeof data == "string" ? JSON.parse(data) : data
                    publish(p);
                    data = "";
                } catch (e) {
                }
            }
            if (data.length > 1024 * 10) {
                data = "";
            }
        });
        res.on("end", poll.bind(null, url, type));
    }).on("error", poll.bind(null, url, type));
    request.setTimeout(0);
}

function open_events() {
    poll("https://stream.meetup.com/2/open_events", "open_event");
}

function open_venues() {
    poll("https://stream.meetup.com/2/open_venues", "open_venue");
}