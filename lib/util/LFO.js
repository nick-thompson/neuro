var AbstractNode = require('../AbstractNode');

/**
 * An LFO utility for scaling oscillator output appropriately.
 *
 * The output of the LFO will be on the range [-scale, scale] where scale
 * is the value provided in the options object.
 *
 * Assuming a sine-based LFO is connected to an AudioParam, the value of
 * the AudioParam, A, at time t will be
 *   value = A.value + sin(t) * scale
 *
 * That is to say that the baseline value will be provided by the `.value`
 * property supplied on the target AudioParam. Thus, for example, suppose you
 * want your AudioParam's value to oscillate on the range [0, 100]. In that
 * case, you should set `.value` = 50, and supply a `scale` parameter to the
 * LFO of 50. The computed result then traverses the range [50 - 50, 50 + 50].
 *
 * Another option involves summing two LFOs of the same frequency and oscillator
 * type. Pretty simply, the range [-scale, scale] summed once with itself
 * becomes [0, 2 * scale].
 *
 * @param {AudioContext} context
 * @param {Object} opts
 * @param {Number} opts.scale
 * @param {Number} opts.freq
 * @param {String} opts.type
 */

function LFO(context, opts) {
  AbstractNode.call(this, context);
  this.osc = context.createOscillator();
  this.scale = context.createGain();

  opts = opts || {};
  this.osc.frequency.value = opts.freq || 440;
  this.osc.type = opts.type || 'sine';
  this.scale.gain.value = opts.scale || 1.0;

  this.osc.connect(this.scale);
  this.scale.connect(this.output);

  this.osc.start(0);
}

LFO.prototype = Object.create(AbstractNode.prototype);

module.exports = LFO;
