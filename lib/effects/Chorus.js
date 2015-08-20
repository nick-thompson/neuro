var AbstractNode = require('../AbstractNode');
var LFO = require('../util/LFO');

/**
 * A simple chorus effect implementation.
 *
 * @param {AudioContext} ctx
 */

function Chorus(ctx) {
  AbstractNode.call(this, ctx);
  this.attenuator = ctx.createGain();
  this.split = ctx.createChannelSplitter(2);
  this.leftDelay = ctx.createDelay();
  this.rightDelay = ctx.createDelay();
  this.leftGain = ctx.createGain();
  this.rightGain = ctx.createGain();
  this.merge = ctx.createChannelMerger(2);

  // Routing graph
  this.input.connect(this.attenuator);
  this.attenuator.connect(this.output);
  this.attenuator.connect(this.split);
  this.split.connect(this.leftDelay, 0);
  this.split.connect(this.rightDelay, 0);
  this.leftDelay.connect(this.leftGain);
  this.rightDelay.connect(this.rightGain);
  this.leftGain.connect(this.merge, 0, 0);
  this.rightGain.connect(this.merge, 0, 1);
  this.merge.connect(this.output);

  // Parameters
  this.depth = 0.335 / 1000;
  this.delay = 0.05 / 1000;
  this.attenuator.gain.value = 0.6934;

  // Modulation.
  // Traditionally, a chorus effect will modulate the delayTime
  // on both the left and right channel. For this implementation, I'll get
  // the desired effect only modulating one of them.
  this.lfo = new LFO(ctx, {
    freq: 3.828,
    scale: this.depth / 2
  });

  this.lfo.connect(this.rightDelay.delayTime);
}

Chorus.prototype = Object.create(AbstractNode.prototype, {

  delay: {
    enumerable: true,
    get: function() {
      return this._delay;
    },
    set: function(value) {
      this._delay = value;
      this.leftDelay.delayTime.value = value + this.depth / 2;
      this.rightDelay.delayTime.value = value + this.depth / 2;
    }
  }

});

module.exports = Chorus;
