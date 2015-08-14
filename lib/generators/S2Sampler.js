/**
 * A simple sampler encompassing the first resampling phase.
 *
 * @param {AudioContext} ctx
 * @param {AudioBuffer} buffer
 */

function S2Sampler(ctx, buffer) {
  this.context = this.ctx = ctx;
  this.buffer = buffer;

  this.sourceOne = ctx.createBufferSource();
  this.sourceTwo = ctx.createBufferSource();

  this.sourceOne.buffer = buffer;
  this.sourceTwo.buffer = buffer;
  this.sourceTwo.detune.value = 3;

  this.output = ctx.createGain();
  this.output.gain.value = 0.5;

  this.sourceOne.connect(this.output);
  this.sourceTwo.connect(this.output);
}

S2Sampler.prototype.start = function(when) {
  this.sourceOne.start(when);
  this.sourceTwo.start(when);
};

S2Sampler.prototype.stop = function(when) {
  this.sourceOne.stop(when);
  this.sourceTwo.stop(when);
};

S2Sampler.prototype.connect = function(dest) {
  this.output.connect(dest.input ? dest.input : dest);
};

S2Sampler.prototype.disconnect = function(dest) {
  if (!dest) {
    return this.output.disconnect();
  }
  this.output.disconnect(dest.input ? dest.input : dest);
}

module.exports = S2Sampler;
