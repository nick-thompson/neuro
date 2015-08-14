var Bass = require('./lib/generators/Bass');
var RecorderWrapper = require('./lib/util/RecorderWrapper');
var S2Sampler = require('./lib/generators/S2Sampler');

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
    var sampler = new S2Sampler(ctx, buffer);
    sampler.connect(ctx.destination);
    sampler.start(0);
  });
});
