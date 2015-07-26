"use strict";

var assert = require("chai").assert;
var Gitter = require('node-gitter'),
    GitterHelper = require('../../lib/gitter/GitterHelper');

var AppConfig = require('../../config/AppConfig'),
    RoomData = require('../../data/RoomData'),
    Utils = require('../../lib/utils/Utils'),
    KBase = require("../../lib/bot/KBase"),
    BotCommands = require('../../lib/bot/BotCommands');

function clog(msg, obj) {
    Utils.clog("GBot>", msg, obj);
}

var GBot = {

    // TODO refresh and add oneToOne rooms
    init: function() {
        KBase.initAsync();
        this.roomList = [];
        GBot.gitter = new Gitter(AppConfig.token);
        var that = this;
        this.joinKnownRooms();
        this.scanRooms();
        BotCommands.init(this);
    },

    announce: function(opts) {
        this.scanRooms();
        this.joinRoom(opts, true);
    },

    joinRoom: function(opts, announce) {
        var roomUrl = opts.roomObj.name;
        GBot.gitter.rooms.join(roomUrl, function(err, room) {
            if (err) {
                console.warn('Not possible to join the room: ', err, roomUrl);
                return;
            }
            GBot.roomList.push(room)
            GBot.listenToRoom(room);
            var text = GBot.getAnnounceMessage(opts)
            GBot.say(text, room);
            clog('joined> ', room.uri);
            return (room);
        });
    },


    getName: function() {
        return AppConfig.botname;
    },

    say: function(text, room) {
        room.send(text);
    },


    // when a new user comes into a room
    // announce: function(opts) {
    //     clog("Bot.announce", opts);

    getAnnounceMessage: function(opts) {
        var text = "----\n";
        if (opts.who && opts.topic) {
            text += "@" + opts.who + " has a question on\n";
            text += "## " + opts.topic;
        } else if (opts.topic) {
            text += "a question on: **" + opts.topic + "**";
        } else if (opts.who) {
            text += "welcome @" + opts.who;
        }
        return (text);
    },

    checkWiki: function(input) {
        assert.isObject(input, "checkWiki expects an object");
        var topic, str, dmLink;
        clog("checkWiki", input);

        dmLink = AppConfig.dmLink;

        if (topic = KBase.staticReplies[input.cleanTopic])
            return topic;

        if (topic = KBase.getTopic(input.cleanTopic)) {
            clog("topic", topic);
            str = "----\n"
            // str += "## " + input.topic + "\n"
            str += topic.data + "\n"
            str += "----\n"
            str += "\n> ![bothelp](https://avatars1.githubusercontent.com/bothelp?v=3&s=32)"
            str += " [DM bothelp](" + AppConfig.topicDmUri(topic.topic) + ")"
            str += " | [wikilink **" + topic.topic + "**](https://github.com/bothelpers/kbase/wiki/" + topic.topic + ")"
            return str
        }
        // else
        return null
    },

    checkCommands: function(input) {

        var cmds = BotCommands.cmdList.filter(function(c) {
            return (c == input.topic || c == input.text)
        })
        var cmd = cmds[0]
        if (cmd) {
            var res = BotCommands[cmd](input, this);
            return res;
        }
        return false;
    },

    checkHelp: function(input) {
        assert.isObject(input, "checkHelp expects an object");
        var wiki, str, topic;

        wiki = this.checkWiki(input)
        if (wiki) return wiki;

        str = "searching for **" + input.topic + "**";
        return str;
    },

    checkThanks: function(input) {
        assert.isObject(input, "checkThanks expects an object");
        var mentions = input.message.mentions;
        clog("thanks", input);
        return (input);
    },

    // turns raw text input into a json format
    parseInput: function(message) {
        var res, str, topic, cleanText, input;

        cleanText = message.model.text;
        cleanText = cleanText.valueOf();    // get value so we avoid circular refs with input.msg
        cleanText = Utils.sanitize(cleanText);

        // TODO sanitize
        input = {
            text: cleanText,
            message: message,
            help: false,
            thanks: false
        };


        if (res = input.text.match(/(help|wiki|check|hint|tip) (.*)/)) {
            input.topic = res[2]
            input.cleanTopic = input.topic.replace(" ", "-").toLowerCase();
            input.help = true
            input.intent = res[1]
            return input
        }

        if (res = input.text.match(/(thanks|ty|thank you) \@(.*)/)) {
            input.thanks = true;
            return input;
        }

        clog('input', input);
        return input;
    },

    // search all reply methods
    findAnyReply: function(message) {
        var res;
        var input = this.parseInput(message);

        if (input.help) {
            return this.checkHelp(input)
        } else if (input.thanks) {
            return this.checkThanks(input)
        } else if (res = this.checkCommands(input)) {
            return res;
        } else {
            return "you said: " + input.text;
        }

    },


    addToRoomList: function(room) {
        // check for dupes
        this.roomList = this.roomList || [];
        if (this.hasAlreadyJoined(room, this.roomList)) {
            return false;
        };

        clog("addToRoomList", room.name);
        this.roomList.push(room);
        return true;
    },

    hasAlreadyJoined: function(room, roomList) {
        var checks = roomList.filter(function(rm) {
            rm.name == room.name;
        })
        var checkOne = checks[0];
        Utils.warning("GBot", "hasAlreadyJoined:", checkOne);
        if (checkOne) {
            return true;
        }
        return false;
    },

    listenToRoom: function(room) {
        // gitter.rooms.find(room.id).then(function(room) {

        if (this.addToRoomList(room) == false) {
            return;
        }

        // The 'snapshot' event is emitted once, with the last messages in the room
        // events.on('snapshot', function(snapshot) {
        //     console.log(snapshot.length + ' messages in the snapshot');
        // });

        var chats = room.streaming().chatMessages();
        // The 'chatMessages' event is emitted on each new message
        chats.on('chatMessages', function(message) {
            // clog('message> ', message.model.text);
            if (message.operation != "create") {
                // console.log("skip msg reply", msg);
                return;
            }

            if (message.model.fromUser.username == AppConfig.botname) {
                // console.warn("skip reply to bot");
                return;
            }
            message.room = room; // why don't gitter do this?
            GBot.sendReply(message);
        });
    },

    sendReply: function(message) {
        clog(" in|", message.model.fromUser.username + "> " + message.model.text);
        var output = this.findAnyReply(message);
        clog("out| ", output);
        message.room.send(output);
        return (output);
    },

    scanRooms: function(user, token) {
        var user = user || this.gitter.currentUser(),
            token = token || AppConfig.token;

        clog('user', user)
        clog('token', token)
        var that = this;

        GitterHelper.fetchRooms(user, token, function(err, rooms) {
            if (err) Utils.error("GBot", "fetchRooms", rooms);
            clog("scanRooms.rooms", rooms);
            if (!rooms) {
                Utils.warn("cant scanRooms")
                return;
            }
            // else
            rooms.map(function(room) {
                if (room.oneToOne) {
                    clog("oneToOne", room.name)
                    that.gitter.rooms.find(room.id).then(function(roomObj) {
                        that.listenToRoom(roomObj);
                    })
                }
            })
        });
        // GBot.gitter.rooms.find().then(function(rooms) {
        //     clog("found rooms", rooms)
        // })
    },

    // FIXME doesnt work for some reason >.<
    updateRooms: function() {
        GBot.gitter.currentUser()
            .then(function(user) {
                var list = user.rooms(function(err, obj) {
                    clog("rooms", err, obj)
                });
                clog("user", user);
                clog("list", list);
                return (list);
            })
    },

    joinKnownRooms: function() {
        var that = this;
        RoomData.map(function(oneRoomData) {
            var roomUrl = oneRoomData.name;
            // console.log("oneRoomData", oneRoomData);
            // clog("gitter.rooms", that.gitter.rooms);
            that.gitter.rooms.join(roomUrl, function(err, room) {
                if (err) {
                    console.warn('Not possible to join the room: ', err, roomUrl);
                    return;
                }
                that.listenToRoom(room);
                clog('joined> ', room.name);
            });
        })
    }


}

module.exports = GBot;