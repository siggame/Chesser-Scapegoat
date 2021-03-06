// Please do not modify this file.
// Instead have a look at `README.md` for how to start writing you AI.

process.title = "Chesser-Scapegoat";

var fs = require("fs");
var ArgumentParser = require("argparse").ArgumentParser;
var WebSocket = require("ws");

// parse args \\

var parser = new ArgumentParser({description: "Run the JavaScript client with options to connect to a game server. Must provide a game name to play."});
parser.addArgument(["game"], {action: "store", help: "the name of the game you want to play on the server"});
parser.addArgument(["-s", "--server"], {action: "store", dest: "server", defaultValue: "127.0.0.1", help: "the url to the server you want to connect to e.g. locahost:3000"});
parser.addArgument(["-p", "--port"], {action: "store", dest: "port", defaultValue: 3088, help: "the ws port to connect to on the server. Can be defined on the server arg via server:port"});
parser.addArgument(["-n", "--name"], {required: true, action: "store", dest: "playerName", help: "the name you want to use as your AI\"s player name"});
parser.addArgument(["-i", "--index"], {action: "store", dest: "playerIndex", help: "the player number you want to be, with 0 being the first player"});
parser.addArgument(["-w", "--password"], {action: "store", dest: "password", help: "the password required for authentication on official servers"});
parser.addArgument(["-r", "--session"], {action: "store", dest: "session", help: "the requested game session you want to play on the server", defaultValue: "*"});
parser.addArgument(['--printIO'], {action: 'storeTrue', dest: 'printIO', help: '(debugging) print IO through the TCP socket to the terminal'});
parser.addArgument(["--chesser-master"], {required: true, action: "store", dest: "chesserMaster", help: "the address of the Chesser-Master server this connects to",});

var args = parser.parseArgs();



// read in the password file \\

var passwordFile = fs.readFileSync("./password.txt", "utf8");

// it SHOULD just be a string, but let's assume competitors are dumb and add a newline or something

var password = passwordFile.split("\n")[0].replace("\r", "");



// create the client \\

var chesserMaster = "ws://" + args.chesserMaster + "/";
delete args.chesserMaster;

console.log("Connecting to Chess-Master at " + chesserMaster);



// create the "scapegoat" client

var scapegoat = {};

scapegoat.ws = new WebSocket(chesserMaster);

scapegoat.ws.onopen = function open() {
    console.log("Connected to Chesser-Master");
    var str = JSON.stringify({
        event: "register",
        data: {
            type: "Arena",
            name: args.playerName,
            password: password,
            playData: args,
        }
    });

    if(args.printIO) {
        console.log("TO CHESSER-SERVER -> " + str);
    }

    scapegoat.ws.send(str);
    console.log("Registration data sent. Done till game is over");

    var totalTime = 1.8e6; // 30 min
    var timeInterval = 1000; // 1 sec
    var count = 0;
    scapegoat.interval = setInterval(function intervalCheck() {
        if(timeInterval * count > totalTime) {
            console.error("Waited 30 min; human on Chesser never connected. Exiting...");
            process.exit(1);
        }

        console.log("[" + (++count) + "]: no connection Chesser");
    }, timeInterval);
};

scapegoat.ws.onerror = function(err) {
    if(err.code === "ENETUNREACH" || err.code === "ECONNREFUSED") {
        console.error("Could not reach Chesser-Master at " + chesserMaster);
    }
    else {
        console.error(err);
    }

    process.exit(1);
};

scapegoat.ws.onmessage = function(message) {
    if(args.printIO) {
        console.log("FROM CHESSER-SERVER <- " + message.data);
    }

    var parsed;
    try {
        parsed = JSON.parse(message.data);
    }
    catch(err) {
        pased = {
            error: "not valid json",
            data: data,
        };
    }

    if(parsed.event === "message") {
        console.log(parsed.data);
    }
    else if(parsed.event === "bridged") {
        console.log("Connection bridged!");
        clearInterval(scapegoat.interval);
    }
    else {
        console.log(parsed);
    }
};

scapegoat.ws.onclose = function() {
    console.log("Connection closed...");
    process.exit(0);
};

// if after 30 seconds no connection to Chesser-Master can be established, kill yourself
setTimeout(function() {
    if(scapegoat.ws.readyState === WebSocket.CONNECTING) {
        console.log("30 seconds and can't connect to Chesser-Master, exiting...");
        process.exit(1);
    }
}, 30000); // wait 30 sec
