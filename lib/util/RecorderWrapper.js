/**
 * A simple wrapper around window.Recorder for simplifying the procedure
 * for collecting the recorded buffer.
 *
 * @param {AudioContext} ctx
 */

function RecorderWrapper(ctx) {
  this.context = this.ctx = ctx;
  this.input = ctx.createGain();
  this.channels = 1;
  this.recorder = new Recorder(this.input, {
    workerPath: 'recorder/recorderWorker.js',
    numChannels: this.channels
  });
}

RecorderWrapper.prototype.start = function() {
  this.recorder.record();
};

RecorderWrapper.prototype.stop = function(callback) {
  this.recorder.stop();
  this.recorder.getBuffer(function(buffers) {
    var arr = buffers[0];
    var buffer = this.ctx.createBuffer(
      this.channels,
      arr.length,
      this.ctx.sampleRate
    );

    buffer.getChannelData(0).set(arr);
    return callback(buffer);
  }.bind(this));
};

module.exports = RecorderWrapper;
