var Bass = require('./lib/generators/Bass');

var ctx = new AudioContext();
var bass = new Bass(ctx);
var rec = new Recorder(bass, {
  workerPath: 'recorder/recorderWorker.js',
  numChannels: 1
});

var BPM = 130;
var notes = [
  'f1', '__', 'f1', 'f3',
  'f1', 'f1', 'f3', 'f1',
  'f1', '__', '__', '__',
  '__', '__', '__', 'a2'
];

bass.connect(ctx.destination);
rec.record();

bass.play(BPM, 1, notes, function(e) {
  console.log('Recording finished... collecting buffer.');
  rec.stop();
  rec.getBuffer(function(buffers) {
    var source = ctx.createBufferSource();
    var buffer = ctx.createBuffer(1, buffers[0].length, ctx.sampleRate);

    buffer.getChannelData(0).set(buffers[0]);
    source.buffer = buffer;

    source.connect(ctx.destination);
    source.start(0);
  });
});
