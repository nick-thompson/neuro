/**
 * WaveShaper node for a hard clipping curve with configurable drive.
 *
 * @param {AudioContext} ctx
 * @param {Object} opts
 * @param {Number} opts.drive
 */

function WaveShaper(ctx, opts) {
  this.context = this.ctx = ctx;
  this.input = ctx.createGain();
  this.output = ctx.createGain();
  this._ws = ctx.createWaveShaper();

  this._setDrive(opts.drive || 0.5);
  this._setCurve();

  this.input.connect(this._ws);
  this._ws.connect(this.output);
}

WaveShaper.prototype._setDrive = function(drive) {
  this.input.gain.value = drive;
  this.output.gain.value = Math.pow(1.0 / drive, 0.6);
};

WaveShaper.prototype._setCurve = function() {
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
};

WaveShaper.prototype.connect = function(dest) {
  this.output.connect(dest.input ? dest.input : dest);
};

WaveShaper.prototype.disconnect = function(dest) {
  if (!dest) {
    return this.output.disconnect();
  }
  this.output.disconnect(dest.input ? dest.input : dest);
};

module.exports = WaveShaper;
