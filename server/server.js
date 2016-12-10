//=============================================================
// Magnus Persson 2016
//=============================================================
var name = "BadSanta";
var express = require('express');
var app = express(app);
var server = require('http').createServer(app);
var logger = require('util');
var port = 8000;
var external_port = process.env.EXT_PORT;
var version = 0.1;
var hash = require('object-hash');
var Player = require('../share/player.js');
var Common = require('../share/common.js');
var Missile = require('../share/missiles.js');
var fs = require('fs');
var PNG = require('pngjs2').PNG;
var publicIp = require('public-ip');
var mysql = require('mysql');
var generate = require('project-name-generator');

var server_name = generate().dashed;

// DB SETTINGS
var db_host = "<mysql_server_ip>";
var db_db = "<database>";
var db_user = "<db_user>";
var db_pass = "<db_pass>";

var public_ip = "0";
publicIp.v4().then(ip => {
    public_ip = ip; // || process.env.EXT_IP;
    logger.log("\033[92m");
    logger.log("====================================");
    logger.log(name);
    logger.log("====================================");
    logger.log(" Server version",version);
    logger.log(" Server Name:",server_name);
    logger.log("=====================================\033[13m");
    logger.log("Started server on \033[39m"+public_ip+":"+port);
    registerServerToDB();
});

//var timesyncServer = require('timesync/server');
app.use(express.static("../"));
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
//app.use('/timesync', timesyncServer.requestHandler);
var clients = {};

// Routes to get status etc
app.get('/status', function (req, res) {
  res.send(players.length+"/"+common.max_players);
});

app.get('/players', function (req, res) {
  var stats = "";
  for(var p = 0; p < players.length; p++) {
    stats += players[p].name + " Kills: "+players[p].kills + " Deaths: "+players[p].deaths + "<br>";
  }
  res.send(stats);
});

 
var Eureca = require('eureca.io');
var eurecaServer = new Eureca.Server(
    {
     //   transport: 'webrtc',
        allow:
        [
        'spawnLocal',
        'spawnPlayer',
        'serverUpdate',
        'serverDebug',
        'dropPlayer',
        'explode',
        'explodePlayer',
        'setMap',
        'fireMissile',
        'reset',
        'respawn',
        'serverFull',
        'sync',
        ]
    });
eurecaServer.attach(server);


// Globals
var players = [];
var last_update_hash = "";
var common = new Common();
var map = 0;
var mapLoaded = false;
var map_width = 0;
var map_height = 0;
var player_ids = 0;

// Max diff between client / server position of player 
var max_pos_diff = 5;

var explosions = [];
var missiles = [];
var missile_ids = 0;

// Last snapshot sent
var last_snapshot = [];

var last_ts = 0;
var full_snap_ts = 0;
var total_dt = 0;
var server_fps = common.server_fps;

var mapTimeout = common.mapTimeout; 
var map_ts = 0;
var deaths = [];

// Set up the Server update loop.
var updateServer = function() {
    // Check if we have players, otherwise, lower fps.
    clearInterval(server_interval);
    if(players.length === 0) {
        server_fps = 0.5;
    } else {
        server_fps = common.server_fps;
    }
    server_interval = setInterval(updateServer, 1000 / server_fps);
    
    var now_ts = +new Date();
    var last_ts2 = last_ts || now_ts;
    var dt_sec = (now_ts - last_ts2) / 1000.0;
    last_ts = now_ts;
    
    for(var i = 0; i < players.length; i++) {
        if(players[i].alive) {
            players[i].move();
            players[i].checkBorders(map_width, map_height);
        }
        //players[i].remote.serverDebug(players[i].x, players[i].y);
    }
    for(var m = 0; m < missiles.length; m++) {
        missiles[m].update(dt_sec);
        if(missileCollide(missiles[m], missiles[m].x, missiles[m].y, common.missile_power, missiles[m].player_id, missiles[m].id)) {
           missiles.splice(m, 1);
        }
    }

    total_dt += dt_sec;
    // partial snapshot (changes)
    if(total_dt > 1/common.server_phys_fps) {
        sendWorldState(false);
        total_dt = 0;
    }

    // Full snap 
    full_snap_ts += dt_sec;
    if(full_snap_ts > 1/common.server_full_snap_fps) {
        sendWorldState(true);
        full_snap_ts = 0;
    }

    // Check for reload of map.
    map_ts += dt_sec;
    if(map_ts >= mapTimeout) {
        map_ts = 0;
        logger.log("Map Timeout, reloading map.");

        explosions = [];
        missiles = [];
        missile_ids = 0;
        last_ts = 0;
        full_snap_ts = 0;
        last_snapshot = [];

        // Reload map.
        loadMap("../assets/maps/santa2.png");
        // reset players
        var pos = [];
        for(var p = 0; p < players.length; p++) {
            // Generate random spawn points.
            players[p].x = 10+Math.random()*map_width-10;
            players[p].y = 10;
            players[p].reset(players[p].x, players[p].y);
            players[p].remote.reset(players[p].x, players[p].y);
        }
    }

    // Check respawns
    for(var d = 0; d < deaths.length; d++) {
        deaths[d][1] += dt_sec;
        if(deaths[d][1] >= common.player_respawn_time) {
            var pp = deaths[d][0];
            if(players[pp] !== undefined) {
                players[pp].respawn(10+Math.random()*map_width-10, 0);
                for(var l = 0; l < players.length; l++) {
                    players[l].remote.respawn(players[pp].x, players[pp].y, players[pp].id);
                }
                sendWorldState(true); // Full update
            }
            deaths.splice(d, 1);
        }
    }
};

// Start game loop
var server_interval = setInterval(updateServer, 1000 / server_fps);
loadMap("../assets/maps/santa2.png");

function loadMap(map_file) {
    fs.createReadStream(map_file)
    .pipe(new PNG())
    .on('parsed', function() {
        logger.log("Loading map", this.width, this.height);
        map_height = this.height;
        map_width = this.width;
        var tmap = new Array(this.height);
        for (var y = 0; y < this.height; y++) {
            tmap[y] = new Array(this.width);
            for (var x = 0; x < this.width; x++) {
                var idx = (this.width * y + x) << 2;
                tmap[y][x] = (this.data[idx] & 0xFF) << 24 | (this.data[idx+1] & 0xFF) << 16 | (this.data[idx+2] & 0xFF) << 8 | this.data[idx+3] & 0xFF;
            }
        }
        map = new Array(this.width);
        for(var x1 = 0; x1 < this.width; x1++) {
            map[x1] = new Array(this.height);
            for(var y1 = 0; y1 < this.height; y1++) {
                map[x1][y1] = tmap[y1][x1];
            }
        }
        mapLoaded = true;
        logger.log("Map loaded.");
    });
}

//detect client connection
eurecaServer.onConnect(function (conn) {    
    logger.log('New Client: id=%s ', conn.id, conn.remoteAddress);
	
	//the getClient method provide a proxy allowing us to call remote client functions
    var remote = eurecaServer.getClient(conn.id); 
    if(players.length == common.max_players) {
        logger.log("Server FULL (",players.length,"/",common.max_players,")");
        // Max players reached.
        remote.serverFull("Server Full");
        return;
    }
});

//detect client disconnection
eurecaServer.onDisconnect(function (conn) {    
    logger.log('Client disconnected:', conn.id);
    var remove = -1;
    for(var i = 0; i < players.length; i++) {
        if(players[i].conn_id === conn.id) {
            remove = i;
        } else {
            players[i].remote.dropPlayer(conn.id);
        }
    }
    players.splice(remove, 1);
});

eurecaServer.exports.login = function (id) {

    var remote = eurecaServer.getClient(this.user.clientId); 
    if(id !== null) {
        logger.log("Joining with ID:",id);
        var res = id.match(/^[a-zA-Z0-9]*$/g);
        if(res !== null) {
            var connection = mysql.createConnection({
                host     : db_host,
                user     : db_user,
                password : db_pass,
                database : db_db
                //database : 'badsanta_prod'
            });
            connection.connect();
            logger.log("Check database.");
            var that = this;
            var q = connection.query("select player_id, name from players where player_id = '"+id+"'", function(err, rows, fields) {
                if(rows.length !== 0) {
                    logger.log('Player: ', rows[0].name, "joined.");
                    var name = rows[0].name;
                    var player = new Player();
                    player.server_collide = collide;
                    player.name = name;
                    player.server = true;
                    player.conn_id = that.user.clientId;
                    player.id = player_ids++; // small value compared to conn_id to save bw.
                    player.db_id = rows[0].player_id;
                    player.x = 10+Math.random()*map_width-10;
                    player.y = 0;
                    player.alive = true;
                    player.remote = remote;

                    remote.setMap(explosions);

                    // Let others now that this was spawn
                    for(var j = 0; j < players.length; j++) {
                        players[j].remote.spawnPlayer(that.user.clientId, player.id, players[j].x, players[j].y, name);
                    }

                    for(var i = 0; i < players.length; i++) {
                        remote.spawnPlayer(players[i].conn_id, players[i].id, players[i].x, players[i].y, players[i].name);
                    }
                    players.push(player);
                    remote.spawnLocal(player.id, that.user.clientId, player.x, player.y, name);	
                    saveToDB(player.db_id, 2, 0);
                } else {
                    logger.log("Login fail");
                    // Max players reached.
                    remote.serverFull("Login failed");
                }
                connection.end();
            });
            q.on('error', function(err) { logger.log("ERROR:",err);} );
        }
    } else {
        remote.serverFull("Login failed");
    }
};

eurecaServer.exports.dataFromClient = function (input) {
    // Perform for the player itself.
    for(var i = 0; i < players.length; i++) {
        if(players[i].conn_id == this.user.clientId) {
            for(var h = players[i].history.length-1; h >= 0; h--) {
                if(players[i].history[h][2] > input.ts) {
                    continue;
                }
                players[i].x = players[i].history[h][0];
                players[i].y = players[i].history[h][1];
                break;
            }
            players[i].history = []; // Clear history
            players[i].key_right = input.r;
            players[i].key_left = input.l;
            players[i].key_up = input.u;

            if(Math.abs(players[i].x - input.x) < common.max_pos_diff) {
                players[i].x = input.x;
                // Send sync to player?
            } else {
                sendWorldState(false);
            }
            if(Math.abs(players[i].y - input.y) < common.max_pos_diff) {
                players[i].y = input.y;
            } else {
                sendWorldState(false);
            }
            break;
        }
    }
};

eurecaServer.exports.fireMissile = function (angle, mid, x, y) {
    var real_mid = missile_ids++;
    var thisPlayer = 0;
    for(var i = 0; i < players.length; i++) {
        if(players[i].conn_id == this.user.clientId) {
            if(Math.abs(players[i].x - x) < common.max_pos_diff/2) {
                players[i].x = x;
            }
            if(Math.abs(players[i].y - y) < common.max_pos_diff/2) {
                players[i].y = y;
            }
            thisPlayer = players[i];
            break;
        }
    }
    if(thisPlayer.alive === false) {
        return; // Don't shoot if dead!
    }

    for(var j = 0; j < players.length; j++) {
        //if(players[j].conn_id != this.user.clientId) {
            players[j].remote.fireMissile(angle, thisPlayer.id, mid, real_mid);
        //}
    }
    var m = new Missile();
    m.id = real_mid;
    m.player_id = thisPlayer.id;
    m.fire(thisPlayer.x, thisPlayer.y, angle, true);
    missiles.push(m);
};

function explode(x, y, power, pid) {
    var input = {};
    input.x = x;
    input.y = y;
    input.p = power;
    explosions.push(input);
    var removal = common.explode(x|0, y|0, power, true);
    for(var k = 0; k < removal.length; k++) {
        if(removal[k][0] > 0 && removal[k][1] > 0 && removal[k][0] < map_width && removal[k][1] < map_height) {
            map[removal[k][0]][removal[k][1]] = 0;
        }

        // Check for player hit
        for(var p = 0; p < players.length; p++) {
            if((players[p].x |0) === removal[k][0] && (players[p].y|0) === removal[k][1]) {
                // send explode to all players.
                if(players[p].alive) {
                    for(var pp = 0; pp < players.length; pp++) {
                        players[pp].remote.explodePlayer(players[p].id, x,y,power, pid);
                    }
                    playerDied(pid, players[p].id);
                }
            }
        }
    }
}

function playerDied(by_id, dead_id) {
    // Check that player isn't already dead_id
    for(var j = 0; j < players.length; j++) {
        if(!players[j].alive && players[j].id == dead_id) {
            return;
        }
    }
    // Kill the player
    for(var i = 0; i < players.length; i++) {
        if(players[i].id == dead_id && players[i].alive) {
            players[i].deaths++;
            players[i].alive = false;
            saveToDB(players[i].db_id, 1, 1);
            deaths.push([i, 0]);
        }
    }
    // Increase kill count
    for(var ii = 0; ii < players.length; ii++) {
        if(players[ii].id == by_id && players[ii].id != dead_id) {
            players[ii].kills++;
            saveToDB(players[ii].db_id, 0, 1);
            return;
        }
    }
}

function sendWorldState(full_snap) {
    var world_state = [];
    var new_snap = [];
    for (var i = 0; i < players.length; i++) {
        var player = players[i];
        // Save all data for snapshot to be able to see changes next round.
        new_snap.push({
            i: player.id,
            r: player.key_right,
            l: player.key_left,
            u: player.key_up,
            x: player.x,
            y: player.y,
            s: player.scale,
        });
        if(last_snapshot.length !== 0 && full_snap !== true) {
            var input = {};
            for(var s = 0; s < last_snapshot.length; s++) {
                if(last_snapshot[s].i == player.id) {
                    // Check diff.
                    if(player.key_right !== last_snapshot[s].r) {
                        input.r = player.key_right;
                    }
                    if(player.scale !== last_snapshot[s].s) {
                        input.s = player.scale;
                    }
                    if(player.key_left !== last_snapshot[s].l) {
                        input.l = player.key_left;
                    }
                    if(player.key_up !== last_snapshot[s].u) {
                        input.u = player.key_up;
                    }
                  //  if(player.key_down !== last_snapshot[s].d) {
                  //      input.d = player.key_down;
                  //  }
                    if(player.x !== last_snapshot[s].x) {
                        input.x = player.x |0;
                    }
                    if(player.y !== last_snapshot[s].y) {
                        input.y = player.y |0;
                    }
                    if(Object.keys(input).length !== 0) {
                        input.ts = +new Date();
                        input.i = player.id;
                        test = input;
                        world_state.push(input);
                    }
                    break;
                }
            }
        } else {
            world_state.push({
                mts: map_ts,
                s: player.scale,
                k: player.kills,
                d: player.deaths,
                i: player.id,
                r: player.key_right,
                l: player.key_left,
                u: player.key_up,
                x: player.x,
                y: player.y,
                ts: +new Date(),
            });
        }
    }

    if(world_state.length !== 0) {
        // Broadcast the state to all the clients.
        for (var j = 0; j < players.length; j++) {
            players[j].remote.serverUpdate(world_state); 
        }
    }
    last_snapshot = new_snap;
}

function missileCollide(missile, x,y, power, pid, mid) {
    x = x|0;
    y = y|0;
    var exploded = false;

    // Check if a player is hit.
    var x_ = 0;
    var y_ = 0;
    var i = 0;
    for(i = 0; i < players.length; i++) {
        if(players[i].id != pid && players[i].alive) {
            if(players[i].x > x - 15 && players[i].x < x + 15 &&
               players[i].y > y - 15 && players[i].y < y + 15)
                {
                    exploded = true;
                    for(var jj = 0; jj < players.length; jj++) {
                        players[jj].remote.explodePlayer(players[i].id, x,y,power, pid);
                    }
                    playerDied(pid, players[i].id);
                    break;
                }
        }
    }

    if(exploded) {
        explode(x,y,power, pid);
        return true;
    }

    // If already exploded, skip this check.
    if(missile.life_time > 0.02) {
        if(x > 0 && y > 0 && x < map_width && y < map_height) {
            if((map[x][y] & 0xFF) !== 0) {
                for(var j = 0; j < players.length; j++) {
                    players[j].remote.explode(x,y,power, pid, mid);
                }
                explode(x,y,power, pid);
                return true;
            }
        }
    }

    return false;
}

function collide(x,y) {
    if(mapLoaded) {
        x = x |0; //; -sprite_width/2 | 0;
        y = (y+9) |0; //sprite_height/2+1 = 16/2+1 | 0;
    
        if(x > 0 && y > 0 && x < map_width && y < map_height) {
            if((map[x][y] & 0xFF) !== 0) {
                return true;
            }
        }
        return false;
    }
}

// type 0 = kill
// type 1 = death
// type 2 = last_played
function saveToDB(id, type, number) {
    var connection = mysql.createConnection({
        host     : db_host,
        user     : db_user,
        password : db_pass,
        database : db_db
    });
    connection.connect();
    var query = "";
    if(type === 0) {
        query = "update players set kills = kills + 1 where player_id = '"+id+"'";
    } else if(type == 1) {
        query = "update players set deaths = deaths + 1 where player_id = '"+id+"'";
    } else if(type == 2) {
        query = "update players set last_played_ts = unix_timestamp() where player_id = '"+id+"'";
    }
    var q = connection.query(query, function(err, rows, fields) {
        connection.end();
    });
}

function registerServerToDB() {
    var connection = mysql.createConnection({
        host     : db_host,
        user     : db_user,
        password : db_pass,
        database : db_db
    });
    connection.connect();
    logger.log("Adding server to database.");
    var q = connection.query("replace into servers set created_ts = unix_timestamp(), up=true, name = '"+server_name+"', hostname = '"+public_ip+":"+external_port+"'", function(err, rows, fields) {
        connection.end();
    });
}

server.listen(port, "0.0.0.0");
