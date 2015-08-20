var AbstractNode = require('../AbstractNode');

/**
 * A simple wrapper around window.Recorder for simplifying the procedure
 * for collecting the recorded buffer.
 *
 * @param {AudioContext} ctx
 */

function RecorderWrapper(ctx) {
  AbstractNode.call(this, ctx);
  this.channels = 1;
  this.recorder = new Recorder(this.input, {
    workerPath: '/vendor/recorderWorker.js',
    numChannels: this.channels
  });
}

RecorderWrapper.prototype = Object.create(AbstractNode.prototype, {

  start: {
    value: function() {
      return this.recorder.record();
    }
  },

  stop: {
    value: function(callback) {
      this.recorder.stop();
      return this.recorder.getBuffer(function(buffers) {
        var arr = buffers[0];
        var buffer = this.ctx.createBuffer(
          this.channels,
          arr.length,
          this.ctx.sampleRate
        );

        buffer.getChannelData(0).set(arr);
        return callback(buffer);
      }.bind(this));
    }
  }

});

module.exports = RecorderWrapper;
