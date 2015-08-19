/**
 * A simple sampler encompassing the first resampling phase.
 *
 * @param {AudioContext} ctx
 * @param {AudioBuffer} buffer
 * @param {Object} opts
 * @param {Number} opts.detune
 */

function Sampler(ctx, buffer, opts) {
  var detune = !!opts && !!opts.detune ? opts.detune : 0;

  this.context = this.ctx = ctx;
  this.source = ctx.createBufferSource();
  this.buffer = buffer;
  this.source.buffer = buffer;
  this.source.detune.value = detune;
  this.output = ctx.createGain();
  this.source.connect(this.output);
}

Sampler.prototype.play = function(cb) {
  this.source.onended = cb;
  this.start(0);
  this.stop(this.ctx.currentTime + this.buffer.duration);
};

Sampler.prototype.start = function(when) {
  this.source.start(when);
};

Sampler.prototype.stop = function(when) {
  this.source.stop(when);
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
