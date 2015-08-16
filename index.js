var Bass = require('./lib/generators/Bass');
var Filter = require('./lib/effects/Filter');
var Group = require('./lib/generators/Group');
var RecorderWrapper = require('./lib/util/RecorderWrapper');
var Sampler = require('./lib/generators/Sampler');

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

// Bass through distortion

// Step 1.
bass.play(BPM, 1, notes, function(e) {
  console.log('Recording finished... collecting buffer.');
  recorder.stop(function(buffer) {

    // Step 2.
    var recorder = new RecorderWrapper(ctx);
    var s1 = new Sampler(ctx, buffer);
    var s2 = new Sampler(ctx, buffer);
    var gr = new Group(ctx, [s1, s2]);
    var bp = new Filter.Bandpass(ctx, {
      frequency: 140,
      Q: 0.1,
      wet: 0.6,
      dry: 0.4
    });

    // Gr through bandpass then distortion

    // Detune the second sample +3 cents.
    s2.node.detune.value = 3;

    gr.connect(bp);
    bp.connect(recorder);
    bp.connect(ctx.destination);

    recorder.start();
    gr.play(function(e) {
      console.log('Recording finished... collecting buffer.');
      recorder.stop(function(buffer) {

        // Step 3.
        var s1 = new Sampler(ctx, buffer);
        var s2 = new Sampler(ctx, buffer);
        var gr = new Group(ctx, [s1, s2]);

        // Except s1 goes through phaser, s2 goes through distortion
        // Then group goes through LP/BP filter with fun automation

        s2.node.detune.value = 3;
        gr.connect(ctx.destination);

        gr.play(function(e) {
          console.log('Done.');
        });
      });
    });
  });
});
