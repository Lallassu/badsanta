// Do the drawing dance.
function DrawMissile(game) {
    this.game = game;
    this.sprite = 0;
    
    DrawMissile.prototype.create = function(x,y) {

       for(var i = 0; i < this.game.world.missile_sprites.length; i++) {
            if(this.game.world.missile_sprites[i].alive === false) {
                this.sprite = this.game.world.missile_sprites[i];
                this.game.world.missile_sprites[i].alive = true;
                this.game.world.missile_sprites[i].visible = true;
                break;
            }
       }
    };

    DrawMissile.prototype.render = function(x,y) {
        this.sprite.position.x = x;
        this.sprite.position.y = y;
    };

    DrawMissile.prototype.remove = function() {
        this.sprite.alive = false;
        this.sprite.visible = false;
    };
}

function DrawWorld(game) {
    this.game = game;
    this.background = 0;
    this.pixel = { scale: 5, canvas: null, context: null, width: 0, height: 0 };
    this.map = 0;
    this.particles = [];
    this.chunks = [];
    this.pixelUpdate = false;
    this.maxParticles = 1000;
    this.canvas = 0;
    this.sprite = 0;
    this.particleLifeTime = 2;
    this.map_layer = 0;
    this.missile_sprites = [];
    this.santaParts = [];
    this.snow = 0;
    this.snd_blood = 0;
    this.snd_throw = 0;
    this.snd_santa = 0;
    this.snd_explode = 0;
    this.explosions = 0;

    DrawWorld.prototype.addSantaParts = function(x,y) {
        var velo = 100;
        var parts = ["foot", "foot", "hand", "hand", "body", "head"];

        for(var i = 0; i < parts.length; i++) {
            var p = this.game.add.sprite(x, y, parts[i]);
            p.life = 3+Math.random()*5;
            p.rotation = Math.random()*Math.PI;
            this.game.physics.arcade.enable(p);
            p.body.velocity.x = -40+Math.random()*80;
            p.body.velocity.y = -Math.random()*velo;
            this.santaParts.push(p);
        }
    };

    DrawWorld.prototype.reset = function() {
        this.map.destroy();
        this.map = this.game.add.bitmapData(this.background.width, this.background.height);
        this.map.draw('map');
        this.map.update();
        this.map.addToWorld(0,0,0,0,0,0);
    };

    DrawWorld.prototype.drawDot = function(x, y, r, g, b) {
        this.map.setPixel32(
            x|0,
            y|0,
            r, g, b, 255, true);
    };

    DrawWorld.prototype.collide = function(x, y, sprite) {
        if(this.map.getPixel(x | 0, (y+sprite.height/2+1)|0).a !== 0) {
            return true;
        }
        return false;
    };

    DrawWorld.prototype.update = function() {
        this.background.x = this.game.camera.x*0.5;
    };

    DrawWorld.prototype.render = function(delta) {
        var p = 0;
        var pixel = 0;
        var updates = false;
        var newParticleList = [];
        var alive = 0;
        for(var j = 0; j < this.particles.length; j++) {
            p = this.particles[j];
            if(p.body.alive) {
                p.lifeTime -= this.game.delta_ts;
                if(p.lifeTime <= 0.0) {
                    p.body.visible = false;
                    p.body.alive = false;
                    continue;
                }
                pixel = this.map.getPixel(p.position.x|0, p.position.y+1|0);
                if(pixel.a !== 0) {
                    p.body.velocity.y *= -1;
                    p.body.velocity.y /= 1.8;
                    p.body.velocity.x /= 1.8;
                }
                if(pixel.a !== 0 && (p.body.velocity.x | 0) === 0 && (p.body.velocity.y | 0) === 0 && p.body.newVelocity.x |0 === 0 && p.body.newVelocity.y|0 === 0) {
                    if(p.blood) {
                        // paint blood.
                        this.map.setPixel32(p.position.x|0, p.position.y|0, 255,0,0,255, true);
                        //this.pixelUpdate = true;
                    }
                    p.body.visible = false;
                    p.body.alive = false;
                } else {
                    if(p.position.x < 0 || p.position.x > this.background.width || p.position.y > this.background.height || p.position.y < 0 ) {
                        p.body.visible = false;
                        p.body.alive = false;
                    }
                }
            }
        }

        // Update more efficient than each time.
        if(this.pixelUpdate) {
            this.pixelUpdate = false;
            this.map.setPixel32(0, 0, 0, 0 ,0, 0, true);
        }

        // Body parts
        for(var n = 0; n < this.santaParts.length; n++) {
            var pa = this.santaParts[n];
            pixel = this.map.getPixel(pa.position.x|0, pa.position.y+1|0);
            if(pixel.a !== 0) {
                pa.body.velocity.y *= -1;
                pa.body.velocity.y /= 1.8;
                pa.body.velocity.x /= 1.8;
            }
            pa.life -= delta;
            if(pa.life <= 0) {
                pa.destroy();
                this.santaParts.splice(n,1);
            }
        }
        
        this.pixel.context.drawImage(this.game.canvas, 0, 0, this.game.width, this.game.height, 0, 0, this.pixel.width, this.pixel.height);
    };

    DrawWorld.prototype.create = function() {
        this.snd_throw = this.game.add.audio('throw');
        this.snd_blood = this.game.add.audio('blood');
        this.snd_santa = this.game.add.audio('santa');
        this.snd_explode = this.game.add.audio('snowball');


        this.game.physics.startSystem(Phaser.Physics.ARCADE);
        this.game.stage.backgroundColor = '#000';
        this.game.time.advancedTiming = true;  

        //this.game.canvas.style['display'] = 'none';
        this.game.canvas.style.display = 'none';

        //this.pixel.canvas = Phaser.Canvas.create(this.game, window.innerWidth, this.game.height * (window.innerHeight/this.game.height));
        this.pixel.canvas = Phaser.Canvas.create(this.game, window.innerWidth, window.innerHeight);
        this.pixel.context = this.pixel.canvas.getContext('2d');
        Phaser.Canvas.addToDOM(this.pixel.canvas);
        this.pixel.canvas.setAttribute('id', 'scaled');
        this.pixel.canvas.addEventListener('mousedown', this.requestLock.bind(this));
        Phaser.Canvas.setSmoothingEnabled(this.pixel.context, false);
        this.pixel.width = this.pixel.canvas.width;
        this.pixel.height = this.pixel.canvas.height;

        this.background = this.game.add.tileSprite(
            0, 0, 
            game.cache.getImage('background1').width, 
            game.cache.getImage('background1').height, 
            'background1');
        this.background.scale.x = 1;
        this.background.scale.y = 1;
        this.game.world.setBounds(0, 0, this.background.width, this.background.height);

        this.game.physics.arcade.checkCollision.left = false;
        this.game.physics.arcade.checkCollision.right = false;

        
        this.snow = this.game.add.emitter(this.game.world.centerX, -32, 500);
        this.snow.makeParticles('snowflakes', [0, 1, 2, 3, 4, 5]);
        this.snow.maxParticleScale = 0.4;
        this.snow.minParticleScale = 0.2;
        this.snow.setYSpeed(0.1, 0.5);
        this.snow.gravity = -200;
        this.snow.width = this.game.world.width * 1.5;
        this.snow.minRotation = 0;
        this.snow.maxRotation = 40;
        this.snow.start(false, 1000+Math.random()*10000, 40);

        this.game.physics.arcade.gravity.y = 250;

        this.map = this.game.add.bitmapData(this.background.width, this.background.height);
        this.map.draw('map');
        this.map.update();
        this.map.addToWorld(0,0,0,0,0,0);

        // Create missiles 
        for(var j = 0; j < 100; j++) {
            var sprite = this.game.add.sprite(0, 0, 'missile');
            sprite.visible = false;
            sprite.scale.x = 0.2;
            sprite.scale.y = 0.2;
            sprite.anchor.set(0.15,0.15);
            sprite.alive = false;
            this.missile_sprites.push(sprite);
        }
        // Particles 
        for(var i = 0; i < this.maxParticles; i++) {
            var s = this.game.add.sprite(0, 0);
            this.game.physics.arcade.enable(s);
            s.alive = false;
            s.bm = this.game.add.bitmapData(1,1);
            s.id = i;
            this.particles.push(s);
        }

        this.explosions = this.game.add.group();
        this.explosions.createMultiple(30, 'explode');
        this.explosions.forEach(function(t) {
            t.animations.add('explode');
            t.anchor.set(0.5, 0.5);
        }, this);

    };

    DrawWorld.prototype.preload = function() {
        // Sounds
        this.game.load.audio('santa', 'assets/audio/santa.wav');
        this.game.load.audio('blood', 'assets/audio/blood.wav');
        this.game.load.audio('throw', 'assets/audio/throw.wav');
        this.game.load.audio('snowball', 'assets/audio/snowball.wav');

        this.game.load.spritesheet('explode', 'assets/explosion.png', 32, 32);
        this.game.load.spritesheet('snowflakes', 'assets/snowflakes.png', 17, 17);
        //this.game.load.spritesheet('player', 'assets/player.png', 16, 16);
        this.game.load.spritesheet('player', 'assets/santa.png', 16, 16);
        this.game.load.image('foot', 'assets/santa_foot.png');
        this.game.load.image('hand', 'assets/santa_hand.png');
        this.game.load.image('body', 'assets/santa_body.png');
        this.game.load.image('head', 'assets/santa_head.png');
      //  this.game.load.spritesheet('weapons', 'assets/weapon_tiles.png', 16,16);

        //this.game.load.image('background', 'assets/clouds.png');
        this.game.load.image('background1', 'assets/maps/santa2_bg.png');
        this.game.load.image('map', 'assets/maps/santa2.png');
        //this.game.load.image('missile', 'assets/missile.png');
        this.game.load.image('missile', 'assets/snowball.png');
        this.game.load.image('grenade_launcher', 'assets/mg6000.png');
        this.game.stage.disableVisibilityChange = true;
    };

    DrawWorld.prototype.newParticle = function(x, y, color, vel_x, vel_y, blood) {
        if(Math.random() > 0.5 && !blood) {
            this.map.setPixel32(x, y, 0, 0 ,0, 0, false);
            return 0;
        }
        if(color.a === 0) {
            return;
        }
        // Reset velocity
        var p = this.particles.shift();
        p.blood = blood || false;
        p.lifeTime = Math.random()*this.particleLifeTime;
        p.body.reset(x,y);
        p.body.alive = true;
        p.body.visible = true;
        p.bm.setPixel32(0,0, color.r, color.g, color.b, color.a, true);
        p.color = color;
        p.loadTexture(p.bm, 0, false);
        p.position.set(x,y);
        p.body.velocity.x = Math.random()*20*vel_x;
        p.body.velocity.y = Math.random()*20*vel_y;
        p.body.bounce.y = 0.2;
        p.body.bounce.x = 0.2;
        this.particles.push(p);
        this.map.setPixel32(x, y, 0, 0 ,0, 0, false);
        return p;
    };

    DrawWorld.prototype.requestLock = function() {
        //  this.game.input.mouse.requestPointerLock();
    };
}

function DrawWeapon(game, player) {
    this.game = game;
    this.player = player;
    this.type = "grenade_launcher";
    this.sprite = 0;
    this.scale = 0.7;

    DrawWeapon.prototype.create = function() {
        this.sprite = this.game.game.add.sprite(0,3, this.type);
        this.player.draw.sprite.addChild(this.sprite);
        this.sprite.scale.x = this.scale;
        this.sprite.scale.y = this.scale;
        this.sprite.anchor.setTo(0.5, 0.5);
    };

    DrawWeapon.prototype.remove = function() {
        this.sprite.destroy();
    };

    DrawWeapon.prototype.render = function(x,y) {
        if(this.player.local) {
        }
    };
}

function DrawPlayer(game, player) {
    this.game = game;
    this.player = player;
    this.sprite = 0;
    this.nameTag = 0;
    this.name = 0;

    DrawPlayer.prototype.remove = function() {
        this.sprite.destroy();
        this.nameTag.destroy();
        //this.weapon.remove();
     //   delete(this.weapon);
    };
    
    DrawPlayer.prototype.respawn = function(x,y) {
        this.sprite.destroy();
        this.nameTag.destroy();
        this.create(this.player.local, this.player.name);
        this.player.weapon.create();
        //this.sprite.update();
        //this.sprite.visible = true;
        this.sprite.x = x;
        this.sprite.y = y;
    };

    DrawPlayer.prototype.die = function(x, y) {
        this.game.world.snd_blood.play('', 0, this.game.volume(x,y));
        for(var i = 0; i < 100; i++) {
            var c = {};
            var t = Math.random()*30 |0;
            c.r = 255-t;
            c.g = 55-t;
            c.b = 55-t;
            c.a = 255-t;
            this.game.world.newParticle(this.sprite.position.x,this.sprite.position.y, c, 5-Math.random()*10, 5-Math.random()*10, true);
        }
        this.sprite.visible = false;
        this.game.world.addSantaParts(this.sprite.position.x, this.sprite.position.y);
    };

    DrawPlayer.prototype.render = function(x, y, type) {
        this.sprite.position.x = x;
        this.sprite.position.y = y;
        
        if(this.player.local) {
            var rotation = Phaser.Point.angle(new Phaser.Point(this.player.mouse_x, this.player.mouse_y), this.sprite.position);
            if(rotation < Math.PI/2 && rotation > -Math.PI/2) {
               this.sprite.scale.x = 1;
               this.player.draw.nameTag.scale.x = 1;
               this.player.weapon.sprite.scale.x = this.player.weapon.scale;
               this.player.weapon.sprite.scale.y = this.player.weapon.scale;
               this.player.weapon.sprite.rotation = rotation;
            } else if(rotation < -Math.PI/2 || rotation > Math.PI/2){
               this.sprite.scale.x = -1;
               this.player.draw.nameTag.scale.x = -1;

               this.player.weapon.sprite.scale.x = -this.player.weapon.scale;
               this.player.weapon.sprite.scale.y = -this.player.weapon.scale;
               this.player.weapon.sprite.rotation = -rotation;
            }
        }
    };

    DrawPlayer.prototype.create = function(local, name) {
        this.name = name;
        this.sprite = this.game.game.add.sprite(0, 50, 'player');
        this.sprite.scale.x = 1;
        var style = { font: "8px Arial", fill: "#ff0000" };  
        if(local) {
            this.game.game.camera.follow(this.sprite, Phaser.Camera.FOLLOW_LOCKON, 0.1, 0.1);
            style = { font: "8px Arial", fill: "#00ff00" };  
        }
        this.nameTag = this.game.game.add.text(0, 0, name, style);
        this.sprite.addChild(this.nameTag);
        this.nameTag.anchor.setTo(0.5,1.5);

        this.sprite.animations.add('walk', [0, 1, 2], 10, true);
        this.sprite.anchor.setTo(0.5,0.5);
    };
}

module.exports = {
    DrawPlayer: DrawPlayer,
    DrawWorld: DrawWorld,
    DrawMissile: DrawMissile,
    DrawWeapon: DrawWeapon,
};

