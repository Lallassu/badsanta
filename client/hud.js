var Common = require('../share/common.js');

function Hud(game) {
    this.game = game;
    this.respawn_time = 0;
    this.common = new Common();
    this.kills = [];
    this.kills_ts = 0;
    this.is_full = 0;
    this.mapTimeout = 0;

    Hud.prototype.serverFull = function(text) {
        this.is_full = text;
    };

    Hud.prototype.updateMapTimeout = function(ts) {
        this.mapTimeout = (this.common.mapTimeout - ts) |0;
    };

    Hud.prototype.addKill = function(by, dead) {
        this.kills.push([by, dead]); 
    };

    Hud.prototype.updateKillList = function(delta) {
        if(this.kills.length > 0) {
            this.kills_ts += delta;
            if(this.kills_ts > 3) {
                this.kills.shift();
                this.kills_ts = 0;
            }
        }

        // Draw list
        for(var i = 0; i < this.kills.length; i++) {
            if(this.kills[i][0] == this.kills[i][1]) {
                this.game.game.debug.text(this.kills[i][0] +" killed himself!", 120, 10+(10*i), "#ff0000", "8px Verdana");
            } else {
                this.game.game.debug.text(this.kills[i][0] +" killed " + this.kills[i][1], 120, 10+(10*i), "#ff0000", "8px Verdana");
            }
        }
    };

    Hud.prototype.updateScoreboard = function() {
        var y_offset = 40;
        this.game.game.debug.text("Name       Kills  Deaths",5, y_offset, "#AA55CC", "8px Verdana");
       //this.game.game.debug.text("================",5, 40, "#0000FF", "8px Verdana");
        for(var i = 0; i < this.game.players.length; i++) {
            if(this.game.players[i].local) {
                this.game.game.debug.text(this.game.players[i].name, 5, y_offset+10+(10*i), "#00FF00", "8px Verdana");
            } else {
                this.game.game.debug.text(this.game.players[i].name, 5, y_offset+10+(10*i), "#FF0000", "8px Verdana");
            }
            this.game.game.debug.text(this.game.players[i].kills, 55, y_offset+10+(10*i), "#4455FF", "8px Verdana");
            this.game.game.debug.text(this.game.players[i].deaths, 75, y_offset+10+(10*i), "#FF5555", "8px Verdana");
        }
    };

    Hud.prototype.setRespawnTime = function() {
        this.respawn_time = this.common.player_respawn_time;
        $('#respawn_counter').show();
    };

    Hud.prototype.update = function(delta) {
        this.game.game.debug.text(this.game.game.time.fps + " FPS" || '--', 5, 10, "#00ffff", "10px Courier");
        //this.game.game.debug.text(this.game.game.lag + " ms", 50, 10, "#ffffff", "10px Courier");
        this.game.game.debug.text("Game Time: "+this.mapTimeout + " sec", 5, 20, "#ff00ff", "10px Courier");

        this.updateScoreboard();
        if(this.respawn_time >= 0) {
            this.respawn_time -= delta;
            if(this.respawn_time >= 0) {
                //this.game.debug.text("Respawn in "+(this.game.hud.respawn_time |0)+ " seconds", this.background.width/8, 50, "#ff0000", "30px Courier");
                this.game.game.debug.text("Respawn in "+(this.respawn_time |0)+ " seconds",
                                     window.innerWidth/8, window.innerHeight/5, "#ff0000", "30px Courier");
            }
        }

        // Kill list
        this.updateKillList(delta);
        if(this.is_full !== 0) {
            console.log(this.is_full);
            this.game.game.debug.text(this.is_full, 50, 50, "#ff0000", "20px Verdana");
        }
    };
}

module.exports = Hud;
