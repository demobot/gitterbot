/*jslint todo: true */
"use strict";

var LOGTHIS = false;

var assert = require("chai").assert;
var _ = require("lodash-node");

var GBot = require("../../lib/bot/GBot.js"),
    KBase = require("../bot/KBase"),
    Utils = require("../../lib/utils/Utils"),
    TextLib = require("../../lib/utils/TextLib"),
    AppConfig = require("../../config/AppConfig"),
    Bonfires = require("../app/Bonfires"),
    InputWrap = require("../bot/InputWrap"),
    RoomData = require("../../data/RoomData");


// var httpSync = require('http-sync');


var newline = '\n';

    // Rooms = require('../app/Rooms'),
    // RoomData = require('../../data/RoomData');


function clog(msg, obj) {
    Utils.clog("BotCommands>", msg, obj);
}

function tlog(msg, obj) {
    Utils.warn("BotCommands>", msg, obj);
}

// function tlog(p1, p2, p3, p4) {
//     Utils.tlog("BotCommands>", p1, p2, p3, p4);
// }


// var contactBox = "\n if you'd like to help please [get in touch!](https://github.com/freecodecamp/freecodecamp) :thumbsup: ",
//     topLine = "----\n",
//     wipHeader = "\n work in progress!";


var BotCommands = {

    isCommand: function (input) {
        var cmds, one, res;
        cmds = BotCommands.cmdList.filter(function (c) {
            return (c === input.keyword);
        });
        one = cmds[0];
        if (one) {
            res = true;
        } else {
            res = false;
            if (LOGTHIS) {
                Utils.warn('isCommand', 'not command', input);
                Utils.warn('isCommand',
                    `[ isCommand: ${input.keyword} ] one: ${one} | res ${res} ` );
            }
        }
        return res;
    },

    version: function(){
        return "botVersion: " + AppConfig.botVersion;
    },

    botstatus: function (input, bot) {
        if (input.params) {
            return null;    // dont response if they type test something as its probly just chat
        }
        var msg = "All bot systems are go!  \n";
        msg += this.version() + "\n";
        msg += this.botenv();
        // clog("BotCommands.bot", this.bot);
        // msg += AppConfig.getBotName()
        return msg;
    },

    botenv: function(input, bot) {
        var str = "env: " + AppConfig.serverEnv;
        return str;
    },

    // bonfire features
    hint: function(input, bot) {
        var str;
        str = Bonfires.getHint(input);
        return (str);
    },

    links: function(input, bot) {
        var str;
        str = Bonfires.getLinksFromInput(input);
        return str;
    },

    seed: function(input, bot) {
        var str;
        str = Bonfires.getChallengeSeedFromInput(input);
        return str;
    },

    archive: function(input, bot) {
        var str, roomName, shortName, roomUri, timeStamp;
        roomName = input.message.room.name;
        shortName = InputWrap.roomShortName(input);

        roomUri = AppConfig.gitterHost + roomName + "/archives/" ;
        str = "Archives for **" + shortName + "**" + newline;
        str += "\n- [All Time](" + roomUri + "all)";

        timeStamp = Utils.timeStamp("yesterday");
        str += "\n- [Yesterday](" + roomUri + timeStamp + ")";

        // tlog(str);

        return str;
        // https://gitter.im/dcsan/botzy/archives/all
        // date ; //# => Thu Mar 31 2011 11:14:50 GMT+0200 (CEST)
        // https://gitter.im/bothelp/GeneralChat/archives/2015/07/25
    },

    init: function (bot) {
        // FIXME - this is sketchy storing references like a global
        // called from the bot where we don't always have an instance
        BotCommands.bot = bot;
    },

    tooNoisy: function (input, bot) {
        // if this.room.name 
        return false;
    },

    // help on its own we return `help bothelp`
    help: function (input, bot) {
        if (this.tooNoisy(input, bot)) {
            return null;
        }
        // input;
        // var msg = TestHelper.makeInputFromString("help help");
        // return "try this: `wiki $topic` or topics for a list";
        // return bot.findAnyReply(msg);
        if (input.params) {
            return this.wiki(input, bot);
        } else {
            var topicData = KBase.getTopicData("camperbot");
            return topicData.data;
        }
    },

    menu: function (input, bot) {
        var msg = "type help for a list of things the bot can do";
        return msg;
    },

    // TODO - sort alphabetically
    rooms: function (input, bot) {
        var uri, link, str, roomNames, icon;
        var baseList = RoomData.rooms();   // bot.roomList doesnt show private / meta data

        // https://gitter.im/FreeCodeCamp
        str = "## rooms\nSee all the FreeCodeCamp rooms at [gitter.im/FreeCodeCamp](https://gitter.im/FreeCodeCamp)\n"

        roomNames = baseList.map(function (rm) {
            clog("room", rm);
            if (rm.private) {
                return "----";
            } else {
                uri = "https://gitter.im/" + rm.name;
                icon = ":" + (rm.icon || "speech_balloon") + ":";
                link = "\n " + icon + " [" + rm.name + "](" + uri + ")";
                return link;
            }
        });
        str += roomNames.join(" ");
        return str;
    },

    // gitter limits to first 10 lines or so
    // TODO - pagination
    topics: function (input, bot) {
        var str, shortList, list;
        str = "## topics\n";
        shortList = KBase.topicNameList.slice(0, 10);
        list = shortList.map(function (t) {
            return (Utils.linkify(t, "wiki"));
        });
        str += list.join("\n");
        // clog("shortList", shortList);
        // clog("topics", str);
        // return "list"
        return str;
    },

    find: function (input, bot) {
        var str = `find **${input.params}**\n`;
        var shortList = KBase.findTopics(input.params);
        bot.context = {
            state: "finding",
            commands: shortList.commands
        };
        str += shortList;
        clog("find", str);
        return (str);
    },

    commands: function (input, bot) {
        var str = "## commands:\n- ";
        str += BotCommands.cmdList.join("\n- ");
        return str;
    },

    // FIXME - this isn't working it seems
    rejoin: function (input, bot) {
        clog("GBot", GBot);
        BotCommands.bot.scanRooms();
        return "rejoined";
    },
    music: function (input, bot) {
        var str = "## Music!";
        str += "\n http://plug.dj/freecodecamp";
        return str;
    },

    rollem: function (input, bot) {
        var fromUser = "@" + input.message.model.fromUser.username;
        var str = fromUser + " says enjoy!";
        str += "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
        return str;
    },

    wikiUpdate: function (input, bot) {
        return "WIP wiki-update";
    },

    camperCount: function (input, bot) {
        return "WIP camperCount";
    },

    search: function (input, bot) {

        var data = KBase.search(input.params);
        var str = "searching for " + data;
        // var str = topLine + wipHeader;
        // str += "## search for" + input.text;
        // str += "\n results will be here!";
        // str += contactBox;
        return str;
    },

    welcome: function (input, bot) {
        var str;
        if (input.params && input.params.match(/world/i)) {
            str = "## welcome to FreeCodeCamp @" + input.message.model.fromUser.username + "!";
            return str;
        }
        // str += "\n type `help` for some things the bot can do.";
    },

    hello: function(input, bot) {
        return (this.welcome(input, bot) );
    }

};

BotCommands.about = require("./cmds/about");
BotCommands.thanks = require("./cmds/thanks");

// TODO - iterate and read all files in /cmds
var wiki = require("./cmds/wiki"),
    thanks = require("./cmds/thanks");

_.merge(BotCommands, wiki, thanks);

// Object.assign(BotCommands, wiki);

BotCommands.explain = BotCommands.wiki;
BotCommands.bot = BotCommands.wiki;

// setup aliases
BotCommands.hi = BotCommands.welcome;
// BotCommands.bothelp = BotCommands.menu;
// BotCommands.hello = BotCommands.welcome;
BotCommands.index = BotCommands.topics;

BotCommands.log = BotCommands.archive;
BotCommands.archives = BotCommands.archive;

// BotCommands['@bothelp hi'] = BotCommands.menu;

// TODO - some of these should be filtered/as private
BotCommands.cmdList = Object.keys(BotCommands);

clog(BotCommands.cmdList);

module.exports = BotCommands;
