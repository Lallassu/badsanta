function Missile(draw) {
    this.Draw = draw || 0;
    this.draw = 0;
    this.speed = 350;
    this.x = 0;
    this.y = 0;
    this.ay = -9.8;
    this.ax = 0;
    this.angle = 0;
    this.vx = 0;
    this.vy = 0; 
    this.draw = 0;
    this.isServer = false;
    this.id = 0;
    this.life_time = 0;

    Missile.prototype.remove = function() {
        if(!this.isServer) {
            this.draw.remove();
        }
    };

    Missile.prototype.fire = function(x, y, angle, isServer, game) {
        this.isServer = isServer;
        this.x = x;
        this.y = y;
        this.angle = angle;

        if(!this.isServer) {
            this.draw = new this.Draw.DrawMissile(game);
            this.draw.create();
        }
        this.vx = this.speed*Math.cos(this.angle*(Math.PI/180.0));
        this.vy = this.speed*Math.sin(this.angle*(Math.PI/180.0));
    };

    Missile.prototype.update = function(delta) {
        this.x += this.vx*delta;
        this.y -= this.vy*delta;

        this.vx += this.ax*delta*(this.speed/10);
        this.vy += this.ay*delta*(this.speed/10);
        this.life_time += delta;

        if(!this.isServer) {
            this.draw.sprite.rotation = Math.atan2(-this.vy, this.vx);
            this.draw.render(this.x, this.y);
        }
    };


}
module.exports = Missile;
