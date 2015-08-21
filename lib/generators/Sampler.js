var AbstractNode = require('../AbstractNode');

/**
 * A simple sampler instrument.
 *
 * @param {AudioContext} ctx
 * @param {AudioBuffer} buffer
 * @param {Object} opts
 * @param {Number} opts.detune
 */

function Sampler(ctx, buffer, opts) {
  AbstractNode.call(this, ctx);
  this.source = ctx.createBufferSource();
  this.buffer = buffer;
  this.source.buffer = buffer;
  this.source.detune.value = opts && opts.detune || 0;
  this.source.connect(this.output);
}

Sampler.prototype = Object.create(AbstractNode.prototype, {

  start: {
    value: function(when) {
      this.source.start(when);
    }
  },

  stop: {
    value: function(when) {
      this.source.stop(when);
    }
  },

  play: {
    value: function(callback) {
      var timeout = window.setTimeout(callback, 1450);

      this.source.onended = function(e) {
        window.clearTimeout(timeout);
        return callback(e);
      };

      this.start(0);
      this.stop(this.ctx.currentTime + this.buffer.duration);
    }
  }

});

module.exports = Sampler;
