var Bass = require('./lib/generators/Bass');
var Filter = require('./lib/effects/Filter');
var Group = require('./lib/generators/Group');
var RecorderWrapper = require('./lib/util/RecorderWrapper');
var Sampler = require('./lib/generators/Sampler');
var WaveShaper = require('./lib/effects/WaveShaper');

var ctx = new AudioContext();
var bass = new Bass(ctx);
var recorder = new RecorderWrapper(ctx);
var ws = new WaveShaper(ctx, {drive: 2.0});

var BPM = 130;
var notes = [
  'f1', '__', 'f1', 'f3',
  'f1', 'f1', 'f3', 'f1',
  'f1', '__', '__', '__',
  '__', '__', '__', 'a2'
];

bass.connect(ws);
ws.connect(recorder);
ws.connect(ctx.destination);

// Step 1.
recorder.start();
bass.play(BPM, 1, notes, function(e) {
  console.log('Recording finished... collecting buffer.');
  recorder.stop(function(buffer) {

    // Step 2.
    var recorder = new RecorderWrapper(ctx);
    var s1 = new Sampler(ctx, buffer);
    var s2 = new Sampler(ctx, buffer);
    var gr = new Group(ctx, [s1, s2]);
    var ws = new WaveShaper(ctx, {drive: 2.2});
    var bp = new Filter.Bandpass(ctx, {
      frequency: 140,
      Q: 0.1,
      wet: 0.3,
      dry: 0.7
    });

    // Detune the second sample +3 cents.
    s2.node.detune.value = 3;

    gr.connect(bp);
    bp.connect(ws);
    ws.connect(recorder);
    ws.connect(ctx.destination);

    recorder.start();
    gr.play(function(e) {
      console.log('Recording finished... collecting buffer.');
      recorder.stop(function(buffer) {

        // Step 3.
        var s1 = new Sampler(ctx, buffer);
        var s2 = new Sampler(ctx, buffer);
        var gr = new Group(ctx, [s1, s2]);
        var ws = new WaveShaper(ctx, {drive: 2.4});

        s2.node.detune.value = 3;

        // Except s1 goes through phaser, s2 goes through distortion
        gr.connect(ws);
        ws.connect(ctx.destination);

        gr.play(function(e) {
          console.log('Done.');
        });
      });
    });
  });
});
