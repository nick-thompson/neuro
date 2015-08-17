/**
 * A utility node for grouping samplers.
 *
 * @param {AudioContext} ctx
 * @param {Array} samplers
 */

function Group(ctx, samplers) {
  this.context = this.ctx = ctx;
  this.samplers = samplers;
  this.output = ctx.createGain();

  this.output.gain.value = 1.0 / samplers.length;
  this.samplers.forEach(function(sampler) {
    sampler.connect(this.output);
  }, this);
}

Group.prototype.play = function(cb) {
  var left = this.samplers.length;
  this.samplers.forEach(function(sampler) {
    sampler.play(function(e) {
      if (--left === 0) {
        return cb(e);
      }
    });
  });
};

Group.prototype.connect = function(dest) {
  this.output.connect(dest.input ? dest.input : dest);
};

Group.prototype.disconnect = function(dest) {
  if (!dest) {
    return this.output.disconnect();
  }
  this.output.disconnect(dest.input ? dest.input : dest);
};

module.exports = Group;
