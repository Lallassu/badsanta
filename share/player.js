var Common = require('../share/common.js');
var Missile = require('../share/missiles.js');

function Player(draw) {
    this.Draw = draw || 0;
    this.draw = 0;
    this.x = 0;
    this.y = 0;
    this.speed = 200;
    this.id = 0;
    this.server = false;
    this.name = "Bad Santa";
    this.avg_ay = -100;
    this.common = new Common();
    this.conn_id = 0;
    this.missile_id = 0;
    this.history = [];
    this.lerps = false;
    this.alive = true;

    // client-side
    this.mouse_x = 0;
    this.mouse_y = 0;
    this.game = 0;
    this.local = false;
    this.key_left = 0;
    this.key_right = 0;
    this.key_up = 0;
    this.input_sequence_number = 0;
    this.missiles = [];
    this.send_snap_update = 0;
    this.send_full_update = 0;
    this.last_snap = {};
    this.first_snap = true;

    //this.pending_inputs = [];
    this.last_ts = 0;
    this.lerps_x = [];
    this.lerps_y = [];
    this.lerps_ts = 0;
    //this.ghost = 0;

    // server-side
    this.remote = 0;
    this.server_collide = 0;
    this.weapon = 0;
    this.deaths = 0;
    this.kills = 0;
    this.scale = 1;


    //============================================== 
    // Client only 
    //============================================== 
    Player.prototype.remove = function() {
        $('#player_'+this.id).remove();
        $('#'+this.id).remove();
        this.draw.remove();
        //this.ghost.remove();
    };

    Player.prototype.init = function(game) {
        this.game = game;
        if(this.local) {
            document.onkeydown = this.keyHandler.bind(this);
            document.onkeyup =  this.keyHandler.bind(this);
            document.onmousemove = this.mouseMove.bind(this); 
            document.onmousedown = this.mouseClick.bind(this);
        }
        this.draw = new this.Draw.DrawPlayer(this.game, this);
        this.draw.create(this.local, this.name);
        
        this.weapon = new this.Draw.DrawWeapon(this.game, this);
        this.weapon.create();

        //this.ghost = new Draw.DrawPlayer(this.game);
        //this.ghost.create(this.local, "SERVER"); 
    };

    Player.prototype.mouseMove = function(e) {
        this.mouse_x = e.clientX/(window.innerWidth/this.game.game.width)+this.game.game.camera.position.x +2| 0;
        this.mouse_y = e.clientY/(window.innerHeight/this.game.game.height)+this.game.game.camera.position.y +3| 0;
    };

    Player.prototype.mouseClick = function(e) {
        if(this.alive === false) {
            return;
        }
        // Fire missile
        var angle = Phaser.Point.angle(new Phaser.Point(this.mouse_x, this.mouse_y), this.draw.sprite.position);
        angle = -angle * (180/Math.PI);
        this.fireMissile(angle, this.missile_id);
        this.game.server.fireMissile(angle, this.missile_id, this.x, this.y+3);
        this.missile_id++;
    };

    Player.prototype.fireMissile = function(angle, mid) {
        var m = new Missile(this.Draw);
        m.id = mid;
        m.fire(this.x-0.5, this.y+3, angle, false, this.game);
        this.missiles.push(m);
    };

    Player.prototype.lagCompensation = function(input) {
        var dts = +new Date();
        var diff = (dts - input.c_ts) / 1000.0;
        var res = this.speed * diff;
        if(!input.d) {
            res *= -1;
        }
        return res;
    }; 
 
    Player.prototype.lerp = function(type, new_pos) {
       // 100/(1000/60) = 6 frames (server_fps = 10)
       //var frames = (1000.0/this.common.server_fps)/(1000.0/this.game.current_fps);
       //var frames = (1000.0/30)/(1000.0/this.game.current_fps);
       var frames = this.game.current_fps/this.common.server_phys_fps;
       if(frames === 0) {
            return;
       }
       var old = 0;
       var lerps = 0;
       if(type === 0) {
           this.lerps_x = [];
           this.new_x = new_pos; 
           if(new_pos > this.x) {
               this.draw.sprite.scale.x = 1;
               this.draw.nameTag.scale.x = 1;
           } else {
               this.draw.sprite.scale.x = -1;
               this.draw.nameTag.scale.x = -1;
           }
           old = this.x;
           lerps = this.lerps_x; 
       } else if(type === 1) {
           this.lerps_y = [];
           this.new_y = new_pos;
           if(new_pos < this.y) {
              //  this.draw.sprite.animations.frame = 4;
           }
           old = this.y;
           lerps = this.lerps_y;
       }

       var step = Math.abs(old-new_pos)/frames;
       if(step === 0) {
            return;
       }
       if(new_pos < old) { 
           step *= -1; 
       }
       for(var i = 0; i <= frames; i++) {
           lerps.push(old+(i*step));
       }    
    };

    Player.prototype.checkBorders = function(width, height) {
        if(this.x < 10) {
            this.x = 10;
        } else if(this.x > width - 10) {
            this.x = width - 10;
        }
        if(this.y < 10) {
            this.y = 10;
        } else if(this.y > height - 10) {
            this.y = height - 10;
        }
    };

    Player.prototype.update = function(delta) {
        // Only predict local player
        if(this.local) {
            this.move();
            // Send update to server with specific interval.
            this.send_full_update += delta;
            if(this.send_full_update > 1/this.common.client_full_snap_fps) {
                var snap = {
                    x: this.x|0, 
                    y: this.y|0, 
                    r: this.key_right,
                    l: this.key_left,
                    u: this.key_up,
                    ts: +new Date()
                };

                var update = false;
                if(this.first_snap) {
                    this.first_snap = false;
                    update = true;
                } else {
                    for (var key in snap) {
                        if(key === "ts") {
                            continue;
                        }
                        if(snap[key] !== this.last_snap[key]) {
                            update = true;
                            break;
                        }
                    }
                }
                if(update) {
                    this.game.server.dataFromClient(snap);
                    this.last_snap = snap;
                }
                this.send_full_update = 0;
            }
        }

        this.checkBorders(this.game.world.background.width, this.game.world.background.height);
        for(var i = 0; i < this.missiles.length; i++) {
            this.missiles[i].update(delta);
        }

        if(!this.local) {
            this.lerps_ts += delta;
            if(this.lerps_y.length === 0 && this.lerps_x.length === 0 && this.lerps_ts > 0.2) {
                this.draw.sprite.animations.frame = 5;
            }
            if(this.lerps_x.length > 0) {
                this.x = this.lerps_x.shift();
                this.lerps_ts = 0;
            }
            if(this.lerps_y.length > 0) {
                this.y = this.lerps_y.shift();
                this.lerps_ts = 0;
            }
        }
        this.weapon.render(this.x, this.y);
    };


    Player.prototype.keyHandler = function(e) {
        if(this.alive === false) {
            return;
        }
        e = e || window.event;

        var input = {};
        if (e.keyCode == 68) {
            if(!this.key_right && (e.type == "keydown")) {
                this.key_right = 1;
            } else if(this.key_right && e.type == "keyup") {
                this.key_right = 0;
            }
        } else if (e.keyCode == 65) {
            if(!this.key_left && (e.type == "keydown")) {
                this.key_left = 1;
            } else if(this.key_left && e.type == "keyup") {
                this.key_left = 0;
            }
        }
        else if ( e.keyCode == 32) {
            if(!this.key_up && (e.type == "keydown")) {
                this.key_up = 1;
            } else if(this.key_up && e.type == "keyup") {
                this.key_up = 0;
            }
        }  else {
            this.key_left = 0;
            this.key_right = 0;
            this.key_up = 0;
        }

        input.r = this.key_right;
        input.l = this.key_left;
        input.u = this.key_up;
        input.c_ts = +new Date();
        input.x = this.x;
        input.y = this.y;
        this.game.server.dataFromClient(input);
    };


    //============================================== 
    // Shared
    //============================================== 
    Player.prototype.move = function() {
        if(!this.alive) {
            return;
        }
        var now_ts = +new Date();
        var last_ts = this.last_ts || now_ts;
        var dt_sec = (now_ts - last_ts) / 1000.0;
        this.last_ts = now_ts;

        var move = this.speed*dt_sec;
        var moved = false;

        if(this.key_left) { // && !this.collide(this.x-move, this.y)) {
            this.x -= move;
            moved = true;
            if(!this.server) {
              //  this.draw.sprite.scale.x = -1;
                this.draw.sprite.animations.play('walk');
            }
        } else if(this.key_right) { // && !this.collide(this.x+move, this.y)) {
            this.x += move;
            moved = true;
            if(!this.server) {
                //this.draw.sprite.scale.x = 1;
                this.draw.sprite.animations.play('walk');
            }
        }
        if(this.key_up) { // && !this.collide(this.x, this.y-move)) {
            this.y -= move;
            moved = true;
            if(!this.server) {
                this.draw.sprite.animations.frame = 6;
            }
        } 

        if(!moved && !this.server) {
            this.draw.sprite.animations.frame = 5;
        }
        var fy = 39.28; // 4*9.82 (m*g)
        //fy += -1 * 0.5 * this.airDensity * this.area * this.vy * this.vy;
        fy += -0.6;
        var dy = dt_sec + (0.5 * this.avg_ay * dt_sec * dt_sec);

        if(dy < 0) {
            dy = 0.01;
        }
        
        // TBD: Check collision towards world.
        if(!this.key_up && !this.collide(this.x, this.y)) {
            this.y += (dy*this.speed);
            var new_ay = fy / 4;
            if(!this.server) {
                this.draw.sprite.animations.frame = 4;
            }
            this.avg_ay = 0.5 * (new_ay + this.avg_ay); 
        }
        // DEBUG
        //if(this.game.world) {
        //    this.game.world.drawDot(this.x, this.y, 255,0,0);
        //}
        // save to history.
        this.history.push([this.x, this.y, +new Date()]);
    };

    Player.prototype.collide = function(x,y) {
        if(this.server) {
            if(this.server_collide !== 0) {
                return this.server_collide(x,y);
            }
        } else {
            if(this.draw) {
                return this.game.world.collide(x, y, this.draw.sprite);
            }
        }
    };

    Player.prototype.die = function(x, y, power) {
        this.draw.die(x, y);
        this.alive = false;
    };

    Player.prototype.respawn = function(x, y) {
        this.x = x;
        this.y = y;
        this.avg_ay = -100;
        this.history = [];
        this.lerps = false;
        this.last_x = 0;
        this.last_y = 0;
        this.missiles = [];
        this.send_update = 0;
        this.lerps_x = [];
        this.lerps_y = [];
        this.alive = true;
        this.key_left = 0;
        this.key_right = 0;
        this.key_up = 0;
        if(!this.server) {
            this.draw.respawn(x,y);
        }
    };

    Player.prototype.reset = function() {
        this.kills = 0;
        this.deaths = 0;
        this.key_left = 0;
        this.key_right = 0;
        this.key_up = 0;
    };

    //============================================== 
    // Server only
    //============================================== 
    Player.prototype.validateInput = function(input) {
        if (Math.abs(input.press_time) > 1/40) {
            return false;
        }
        return true;
    };
}

module.exports = Player;
