function Common() {
    this.max_pos_diff = 20;
    this.mapTimeout = 180;
    this.max_players = 6;
    this.missile_power = 10;
    this.player_respawn_time = 5;
    this.server_fps = 66;
    this.server_phys_fps = 30;
    this.server_full_snap_fps = 1; 
    this.client_full_snap_fps = 30;
    this.client_partial_snap_fps = 30;
    this.key_right = 1;
    this.key_left = 2;
    this.key_up = 3;
    //this.key_down = 4;

    Common.prototype.explode = function(x, y, power, isServer) {
        var removal = [];
        var all = [];
        var pow = power*power;
        var vx = 0, vy = 0, val = 0, offset = 0;
        for(var rx = x-power; rx <= x+power; rx++) {
            vx = Math.pow((rx-x), 2);
            for(var ry = y-power; ry <= y+power; ry++) {
                val = Math.pow((ry-y),2)*2+vx;
                if(val <= pow) {
                    if(!isServer) {
                        var gy = 0;
                        var gx = 0;
                        if(ry < y ) {
                            gy = 5-Math.random()*10;
                        }  else {
                            gy = 5-Math.random()*10;
                        }
                        if(rx < x) {
                            gx = 5-Math.random()*10;
                        }  else {
                            gx = 5-Math.random()*10;
                        }
                        removal.push([rx, ry, gx, gy]);
                    } else {
                        removal.push([rx, ry]);
                    }
                }// else if(val < pow+10) {
                //  if(rx == this.local_player.sprite.position.x|0 && this.local_player.sprite.position.y|0 == ry) {
                //      this.local_player.die();
                //  }
                // darken pieces
                //   var pixel = this.map.getPixel(rx, ry);
                //   if(pixel.a > 150) {
                //       this.map.setPixel32(rx, ry, pixel.r/2, pixel.g/2, pixel.b/2, pixel.a, false);
                //   }
                //}
            }
        }
        return removal;
    };
}
module.exports = Common;
