var Bass = require('./lib/generators/Bass');
var RecorderWrapper = require('./lib/util/RecorderWrapper');

var ctx = new AudioContext();
var bass = new Bass(ctx);
var recorder = new RecorderWrapper(bass);

var BPM = 130;
var notes = [
  'f1', '__', 'f1', 'f3',
  'f1', 'f1', 'f3', 'f1',
  'f1', '__', '__', '__',
  '__', '__', '__', 'a2'
];

bass.connect(ctx.destination);
recorder.start();

bass.play(BPM, 1, notes, function(e) {
  console.log('Recording finished... collecting buffer.');
  recorder.stop(function(buffer) {
    var sourceOne = ctx.createBufferSource();
    var sourceTwo = ctx.createBufferSource();

    sourceOne.buffer = buffer;
    sourceTwo.buffer = buffer;
    sourceTwo.detune.value = 3;

    sourceOne.connect(ctx.destination);
    sourceTwo.connect(ctx.destination);
    sourceOne.start(0);
    sourceTwo.start(0);
  });
});
