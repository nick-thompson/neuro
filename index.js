var Bass = require('./lib/generators/Bass');

var ctx = new AudioContext();
var bass = new Bass(ctx);

var BPM = 130;
var notes = [
  'f1', '__', 'f1', 'f3',
  'f1', 'f1', 'f3', 'f1',
  'f1', '__', '__', '__',
  '__', '__', '__', 'a2'
];

bass.connect(ctx.destination);
bass.play(BPM, 1, notes, function(e) {
  console.log('done');
});
