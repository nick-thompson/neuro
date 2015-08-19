var Bass = require('./lib/generators/Bass');
var Filter = require('./lib/effects/Filter');
var RecorderWrapper = require('./lib/util/RecorderWrapper');
var Sampler = require('./lib/generators/Sampler');
var WaveShaper = require('./lib/effects/WaveShaper');

var ctx = new AudioContext();
var BPM = 168;

// A simple helper function to play an arbitrary number of instruments,
// and fire the callback only when each instrument has finished playing.
function play() {
  var len = arguments.length;
  var callback = arguments[--len];
  var left = len;
  for (var i = 0; i < len; i++) {
    arguments[i].play(function(e) {
      if (--left === 0) {
        return callback(e);
      }
    });
  }
}

function stepOne(callback) {
  var bass = new Bass(ctx);
  var recorder = new RecorderWrapper(ctx);
  var ws = new WaveShaper(ctx, {drive: 2.0});
  var notes = [
    'g#1', 'g#1', '__', 'g#3',
    'g#1', 'g#1', '__', 'b2',
    'g#1', 'g#1', 'g#1', 'g#1',
    '__', 'g#2', '__', 'c#2'
  ];

  bass.connect(ws);
  ws.connect(recorder);
  ws.connect(ctx.destination);

  recorder.start();
  bass.play(BPM, 1, notes, function(e) {
    recorder.stop(callback);
  });
}

function stepTwo(buffer, callback) {
  var recorder = new RecorderWrapper(ctx);
  var s1 = new Sampler(ctx, buffer);
  var s2 = new Sampler(ctx, buffer, {detune: 3});
  var gain = ctx.createGain();

  gain.gain.value = 0.5;

  s1.connect(gain);
  s2.connect(gain);
  gain.connect(recorder.input);
  gain.connect(ctx.destination);

  recorder.start();
  play(s1, s2, function(e) {
    recorder.stop(callback);
  });
}

function stepThree(buffer, callback) {
  var s1 = new Sampler(ctx, buffer);
  var s2 = new Sampler(ctx, buffer, {detune: 5});
  var gain = ctx.createGain();

  gain.gain.value = 0.5;

  s1.connect(gain);
  s2.connect(gain);
  gain.connect(ctx.destination);

  play(s1, s2, function(e) {
    callback();
  });
}

// Waterfall
stepOne(function(b1) {
  stepTwo(b1, function(b2) {
    stepThree(b2, function() {
      console.log('Done');
    });
  });
});
