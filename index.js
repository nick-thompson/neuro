var Bass = require('./lib/generators/Bass');
var RecorderWrapper = require('./lib/util/RecorderWrapper');
var Sampler = require('./lib/generators/Sampler');
var Group = require('./lib/generators/Group');

var ctx = new AudioContext();
var bass = new Bass(ctx);
var recorder = new RecorderWrapper(ctx);

var BPM = 130;
var notes = [
  'f1', '__', 'f1', 'f3',
  'f1', 'f1', 'f3', 'f1',
  'f1', '__', '__', '__',
  '__', '__', '__', 'a2'
];

bass.connect(recorder);
bass.connect(ctx.destination);
recorder.start();

// Step 1.
bass.play(BPM, 1, notes, function(e) {
  console.log('Recording finished... collecting buffer.');
  recorder.stop(function(buffer) {

    // Step 2.
    var s1 = new Sampler(ctx, buffer);
    var s2 = new Sampler(ctx, buffer);
    var gr = new Group(ctx, [s1, s2]);
    var recorder = new RecorderWrapper(ctx);

    s2.node.detune.value = 3;
    gr.connect(recorder);
    gr.connect(ctx.destination);

    recorder.start();
    gr.play(function(e) {
      console.log('Recording finished... collecting buffer.');
      recorder.stop(function(buffer) {

        // Step 3.
        var s1 = new Sampler(ctx, buffer);
        s1.connect(ctx.destination);
        s1.play();
      });
    });
  });
});
