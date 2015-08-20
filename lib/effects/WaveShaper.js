var AbstractNode = require('../AbstractNode');

/**
 * WaveShaper node for a hard clipping curve with configurable drive.
 *
 * @param {AudioContext} ctx
 * @param {Object} opts
 * @param {Number} opts.drive
 */

function WaveShaper(ctx, opts) {
  AbstractNode.call(this, ctx);
  this._ws = ctx.createWaveShaper();

  var drive = !!opts && !!opts.drive ? opts.drive : 0.5;
  this.input.gain.value = drive;
  this.output.gain.value = Math.pow(1.0 / drive, 0.6);
  this._setCurve();

  this.input.connect(this._ws);
  this._ws.connect(this.output);
}

WaveShaper.prototype = Object.create(AbstractNode.prototype, {

  _setCurve: {
    value: function() {
      var n = 65536;
      var curve = new Float32Array(n);

      for (var i = 0; i < n; i++) {
        var x = (i - (n / 2)) / (n / 2);

        // Identity
        // curve[i] = x;

        // Hard clipping
        curve[i] = 0.5 * (Math.abs(x + 0.63) - Math.abs(x - 0.63));

        // Soft clipping
        // curve[i] = Math.tanh(x);

        // Soft clipping cubic approximation
        // curve[i] = x - Math.pow(x, 3) / 4;
      }

      this._ws.curve = curve;
      this._ws.oversample = '2x';
    }
  }

});

module.exports = WaveShaper;
