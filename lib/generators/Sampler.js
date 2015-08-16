/**
 * A simple sampler encompassing the first resampling phase.
 *
 * @param {AudioContext} ctx
 * @param {AudioBuffer} buffer
 */

function Sampler(ctx, buffer) {
  this.context = this.ctx = ctx;
  this.node = ctx.createBufferSource();
  this.buffer = buffer;
  this.node.buffer = buffer;
  this.output = ctx.createGain();
  this.node.connect(this.output);
}

Sampler.prototype.play = function(cb) {
  this.node.onended = cb;
  this.start(0);
  this.stop(this.ctx.currentTime + this.buffer.duration);
};

Sampler.prototype.start = function(when) {
  this.node.start(when);
};

Sampler.prototype.stop = function(when) {
  this.node.stop(when);
};

Sampler.prototype.connect = function(dest) {
  this.output.connect(dest.input ? dest.input : dest);
};

Sampler.prototype.disconnect = function(dest) {
  if (!dest) {
    return this.output.disconnect();
  }
  this.output.disconnect(dest.input ? dest.input : dest);
};

module.exports = Sampler;
