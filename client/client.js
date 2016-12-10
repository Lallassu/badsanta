var Player = require('../share/player.js');
var Draw = require('../client/draw.js');
var Common = require('../share/common.js');
var Hud = require('../client/hud.js');

var game = new Game();
game.init();

function Game() {
    this.game = 0;
    this.players = [];
    this.mq = [];
    this.server = 0;
    this.net = 0;
    this.current_fps = 0;
    this.tmp_fps = 0;
    this.last_ts = 0;
    this.total_t = 0;
    this.world = 0;
    this.common = new Common();
    this.hud = 0;
    this.dt_sec = 0;
    this.first_local_spawn = true;

    Game.prototype.getUrlVars = function() {
        var vars = {};
        var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
            vars[key] = value;
        });
        return vars;
    };

    Game.prototype.preload = function() {
        this.world.preload();
    };

    Game.prototype.create = function() {
        this.world.create();

        this.net = new Eureca.Client();
        
        this.net.ready(this.clientReady.bind(this));
        this.net.exports.spawnLocal = this.spawnLocal.bind(this);
        this.net.exports.spawnPlayer = this.spawnPlayer.bind(this);
        this.net.exports.serverUpdate = this.serverUpdate.bind(this);
        this.net.exports.serverDebug = this.serverDebug.bind(this);
        this.net.exports.dropPlayer = this.dropPlayer.bind(this);
        this.net.exports.explode = this.explode.bind(this);
        this.net.exports.explodePlayer = this.explodePlayer.bind(this);
        this.net.exports.setMap = this.setMap.bind(this);
        this.net.exports.fireMissile = this.fireMissile.bind(this);
        this.net.exports.reset = this.reset.bind(this);
        this.net.exports.respawn = this.respawn.bind(this);
        this.net.exports.serverFull = this.serverFull.bind(this);

    };

    Game.prototype.serverFull = function(text) {
        this.hud.serverFull(text);
        setTimeout(function() {
            window.location = "http://santa.qake.se";
        }, 1500);
    };

    Game.prototype.respawn = function(x, y, id) {
        for(var p = 0; p < this.players.length; p++) {
            if(this.players[p].id == id) {
                this.players[p].respawn(x,y);
                break;
            }
        }
    };

    Game.prototype.reset = function(x, y) {
        this.mq = [];
        this.total_t = 0;
        this.last_ts = 0;

        // reset map. 
        this.world.reset();
        for(var p = 0; p < this.players.length; p++) {
            if(this.players[p].local) {
                this.players[p].x = x;
                this.players[p].y = y;
            }
            this.players[p].reset();
            this.players[p].respawn(this.players[p].x, this.players[p].y);
        }
    };


    Game.prototype.init = function() {
        console.log("Game init");
        this.game = new Phaser.Game(
            680, 
            250,
            Phaser.CANVAS, '', 
            {
                create: this.create.bind(this),
                preload: this.preload.bind(this),
                render: this.render.bind(this),
                update: this.update.bind(this),
            }
        );
        this.hud = new Hud(this);
        this.game.hud = this.hud;
        this.world = new Draw.DrawWorld(this.game);

    };

    Game.prototype.dropPlayer = function(conn_id) { 
        console.log("Drop player", conn_id);
        for(var i = 0; i < this.players.length; i++) {
            if(this.players[i].conn_id == conn_id) {
                this.players[i].remove();
                this.players.splice(i,1);
                break;
            }
        }
    };

    Game.prototype.setMap = function(explosions) {
        for(var i = 0; i < explosions.length; i++) {
            var removal = this.common.explode(explosions[i].x,explosions[i].y, explosions[i].p, false);
            for(var j = 0; j < removal.length; j++) {
                this.world.map.setPixel32(removal[j][0],removal[j][1],0,0,0,0,false);
            }
        }
        this.world.pixelUpdate = true;
    };

    Game.prototype.spawnLocal = function(id, conn_id, x, y, name) { 
        console.log("SPAWN LOCAL: ",name, conn_id, id);
        var p = new Player(Draw);
        p.name = name;
        p.id = id;
        p.x = x;
        p.y = y;
        p.conn_id = conn_id;
        p.alive = false;
        p.local = true;
        p.init(this);
        this.players.push(p);
        this.world.snd_santa.play('', 0, this.volume(x,y));
    };

    Game.prototype.clientReady = function(proxy) {
        console.log("Client ready");
        this.server = proxy;
        var v = this.getUrlVars();
        this.server.login(v.id);
    };

    Game.prototype.spawnPlayer = function(conn_id, id, x, y, name) {
        var p = new Player(Draw);
        console.log("SPAWN REMOTE: ",name, conn_id, id);
        p.name = name;
        p.id = id;
        p.conn_id = conn_id;
        p.x = x;
        p.y = y;
        p.local = false;
        p.init(this);
        this.players.push(p);
    };

    Game.prototype.render = function() {
        for(var i = 0; i < this.players.length; i++) {
            this.players[i].draw.render(this.players[i].x, this.players[i].y);
        }
        this.hud.update(this.dt_sec);
        this.world.render(this.dt_sec);
    };

    Game.prototype.update = function() {
        var now_ts = +new Date();
        var last_ts = this.last_ts || now_ts;
        this.dt_sec = (now_ts - last_ts) / 1000.0;
        this.game.delta_ts = this.dt_sec;
        this.last_ts = now_ts;
        this.total_t += this.dt_sec;
        this.tmp_fps++;
        if(this.total_t >= 1) {
            this.current_fps = this.tmp_fps;
            this.tmp_fps = 0;
            this.total_t = 0;
        }

        this.processServerMessages();
        for(var i = 0; i < this.players.length; i++) {
            this.players[i].update(this.dt_sec);
        }

        this.world.update();
    };

    Game.prototype.fireMissile = function(angle, id, mid, real_mid) {
        for(var i = 0; i < this.players.length; i++) {
            if(this.players[i].id == id) {
                this.world.snd_throw.play('', 0, this.volume(this.players[i].x, this.players[i].y));
                if(!this.players[i].local) {
                    this.players[i].fireMissile(angle, real_mid);
                } else {
                    // Update real_mid (global mid)
                    for(var m = 0; m < this.players[i].missiles.length; m++) {
                        if(this.players[i].missiles[m].id == mid) {
                            this.players[i].missiles[m].id = real_mid;
                            break;
                        }
                    }
                }
            }
        }
    };

    Game.prototype.volume = function(x1, y1) {
        var localPlayer = 0;
        for(var i = 0; i < this.players.length; i++) {
            if(this.players[i].local) {
                localPlayer = this.players[i];
                break;
            }
        }
        if(localPlayer === 0) { return 1; }
        
        var x2 = localPlayer.x;
        var y2 = localPlayer.y;
        var dist =  Math.sqrt(Math.pow(x2 - x1,2) + Math.pow(y2 - y1,2));
        var vol = 1/(dist/100);
        return vol > 1? 1: vol;
    };

    Game.prototype.explode = function(x,y, power, pid, mid) {
        var explosion = this.world.explosions.getFirstExists(false);
        explosion.reset(x,y);
        explosion.play('explode', 30, false, true);

        this.world.snd_explode.play('', 0, this.volume(x,y));
        for(var i = 0; i < this.players.length; i++) {
            if(this.players[i].id == pid) {
                for(var m = 0; m < this.players[i].missiles.length; m++) {
                    if(this.players[i].missiles[m].id == mid) {
                        this.players[i].missiles[m].remove();
                        this.players[i].missiles.splice(m, 1);
                    }
                }
            }
        }
        var removal = this.common.explode(x,y, power, false);
        for(var k = 0; k < removal.length; k++) {
            this.world.newParticle(removal[k][0], removal[k][1], 
                                   this.world.map.getPixel(removal[k][0], removal[k][1]), 
                                   removal[k][2], removal[k][3]);
        }
        this.world.pixelUpdate = true;
    };

    Game.prototype.explodePlayer = function(id, x, y, power, pid) {
        for(var i = 0; i < this.players.length; i++) {
            if(this.players[i].id == id) {
                if(this.players[i].local) {
                    this.hud.setRespawnTime();
                }
               this.players[i].die(x, y, power);
               for(var p = 0; p < this.players.length; p++) {
                   if(this.players[p].id == pid) {
                       this.hud.addKill(this.players[p].name, this.players[i].name);
                       break;
                   }
               }
            }
        }
    };

    Game.prototype.serverDebug = function(x, y) {
        this.world.drawDot(x,y, 255, 255, 255);
    };

    Game.prototype.serverUpdate = function(data) {
        this.game.lag = (+new Date())-data[0].ts;
        this.mq.push(data);
    };

    Game.prototype.processServerMessages = function() {
        while (true) {
            var message = this.mq.pop();
            if (!message) {
                break;
            }

            // Start local if first package.
            if(this.first_local_spawn) {
                for(var pp = 0; pp < this.players.length; pp++) {
                    if(this.players[pp].local) {
                        this.players[pp].alive = true;
                        this.first_local_spawn = false;
                    }
                }
            }

            // World state is a list of entity states.
            for (var i = 0; i < message.length; i++) {
                var state = message[i];
                var player = 0;
                for(var p = 0; p < this.players.length; p++) {
                    if(state.i === this.players[p].id) {
                       player = this.players[p];
                       break;
                    }
                }
                if(player === 0) {
                    continue;
                }

                if(state.k) {
                    player.kills = state.k;
                }
                if(state.d) {
                    player.deaths = state.d;
                }
                if(state.mts) {
                    // Update map timeout.
                    this.hud.updateMapTimeout(state.mts);
                }


                if(!player.local) {
                    var walk = false;
                   // if(state.l) {
                   //     if(state.l == 1) {
                   //         player.draw.nameTag.scale.x = -1;
                   //         walk = true;
                   //     }
                   //     player.key_left = state.l;
                   // }
                   // if(state.r) {
                   //     if(state.r == 1) {
                   //         player.draw.nameTag.scale.x = 1;
                   //         walk = true;
                   //     }
                   //     player.key_right = state.r;
                   // }
                   // if(state.u) {
                   //     player.key_up = state.u;
                   //     if(state.u == 1) {
                   //         player.draw.sprite.animations.frame = 6;
                   //         walk = false;
                   //     }
                   // }

                    if(state.x) {
                        if(player.lerps_x.length > 0 ) {
                            player.x = player.lerps_x.pop();
                        }
                        walk = true;
                        if(Math.abs(state.x - player.x) > 1) {
                            player.lerp(0, state.x);
                        }
                    }
                    if(state.y) {
                        if(player.lerps_y.length > 0 ) {
                            player.y = player.lerps_y.pop();
                        }
                        walk = false;
                        //player.draw.sprite.animations.frame = 6;
                        if(Math.abs(state.y - player.y) > 1) {
                            player.lerp(1, state.y);
                        }
                    }
                    if(walk) {
                        player.draw.sprite.animations.play('walk');
                    }
                } else {
                    var dts = (+new Date()-state.ts);
                    if(state.x) {
                        var hx = 0;
                        var hdiff = 0;
                        for(var h = player.history.length-1; h >= 0; h--) {
                            if(player.history[h][2] > state.ts) {
                                continue;
                            }
                            hx = Math.abs(state.x - player.history[h][0]);
                            hdiff = state.ts - player.history[h][2];
                            break;
                        }
                        var dx = Math.abs(player.x-state.x);
                        if(hdiff > dts) {
                            // use dts
                            var cx = player.speed*(dts/1000.0); // change X for lag.
                            dx = Math.abs(dx-cx);
                        } else {
                            // use from history.
                            dx = Math.abs(hx-dx);
                        }
                        if(dx > this.common.max_pos_diff) {
                            player.x = state.x;
                        }
                    }
                    if(state.y) {
                        var hy = 0;
                        var hydiff = 0;
                        for(var hh = player.history.length-1; hh >= 0; hh--) {
                            if(player.history[hh][2] > state.ts) {
                                continue;
                            }
                            hy = Math.abs(state.y - player.history[hh][1]);
                            hydiff = state.ts - player.history[hh][2];
                            break;
                        }
                        var dy = Math.abs(player.y-state.y);
                        if(hydiff > dts) {
                            // use dts
                            var cy = player.speed*(dts/1000.0); // change X for lag.
                            dy = Math.abs(dy-cy);
                        } else {
                            // use from history.
                            dy = Math.abs(hy-dy);
                        }
                        if(dy > this.common.max_pos_diff) {
                            player.y = state.y;
                        }
                    }
                    player.history = [];
                }
            }
        }
    };
}

