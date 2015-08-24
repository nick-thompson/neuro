var Bass = require('./lib/generators/Bass');
var Chorus = require('./lib/effects/Chorus');
var Filter = require('./lib/effects/Filter');
var NProgress = require('nprogress');
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

// Returns a random number generator weighted towards the lower end of the
// provided range.
function makeRandomGenerator(min, max, weight) {
  return function rand() {
    return Math.pow(Math.random(), weight) * (max - min + 1) + min;
  }
}

function uniformRandInt(min, max) {
  return Math.random() * (max - min + 1) + min;
}

function scheduleFilterAutomation(param, steps, rand) {
  var beats = 4;
  var duration = (60 / BPM) * beats;
  var interval = duration / steps;

  param.setValueAtTime(rand(), ctx.currentTime);

  for (var i = 0; i < steps; i++) {
    var delta = (i + 1) * interval;
    var t = ctx.currentTime + delta;

    param.exponentialRampToValueAtTime(rand(), t);
  }
}

function scheduleParallelFilterAutomation(p1, p2, steps, rand) {
  var beats = 4;
  var duration = (60 / BPM) * beats;
  var interval = duration / steps;
  var init = rand();

  p1.setValueAtTime(init, ctx.currentTime);
  p2.setValueAtTime(init / 2, ctx.currentTime);

  for (var i = 0; i < steps; i++) {
    var delta = (i + 1) * interval;
    var t = ctx.currentTime + delta;
    var r = rand();

    p1.exponentialRampToValueAtTime(r, t);
    p2.exponentialRampToValueAtTime(r / 2, t);
  }
}

// Step one is just the raw bass synth sent through a waveshaper and recorded
// out to a buffer.
function stepOne(callback) {
  var bass = new Bass(ctx);
  var recorder = new RecorderWrapper(ctx);
  var ws = new WaveShaper(ctx, {amount: 0.6});
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

// In step two, we duplicate the incoming buffer and play one duplicate next
// to the other but detuned +3 cents. We then send both sources through two
// parallel effects racks. In the first, we have two heavily-modulated filters,
// followed by a chorus. In the second, we send just the dry signal through.
// The result is then merged and sent through a soft compression, slight EQ,
// and additional filter modulation before being recorded out to buffer.
function stepTwo(buffer, callback) {
  var recorder = new RecorderWrapper(ctx);
  var s1 = new Sampler(ctx, buffer);
  var s2 = new Sampler(ctx, buffer, {detune: 3});
  var bp = new Filter.Bandpass(ctx, {Q: 0.8});
  var notch = new Filter.Notch(ctx, {Q: 2.0});
  var ws = new WaveShaper(ctx, {amount: 0.6, drive: 0.6});
  var cr = new Chorus(ctx);
  var m1 = ctx.createGain();
  var m2 = ctx.createGain();
  var m3 = ctx.createGain();
  var comp = ctx.createDynamicsCompressor();
  var eq1 = new Filter.Peaking(ctx, {
    frequency: 128,
    gain: 2.0
  });
  var eq2 = new Filter.Peaking(ctx, {
    frequency: 4500,
    Q: 2.0,
    gain: 3.0
  });
  var eq3 = new Filter.Peaking(ctx, {
    frequency: 11000,
    gain: -3.0
  });
  var eq4 = new Filter.Highpass(ctx, {frequency: 20});
  var lp = new Filter.Lowpass(ctx, {Q: 2.0});
  var bp2 = new Filter.Bandpass(ctx, {Q: 0.8});

  // Merge the duplicate buffers
  s1.connect(m1);
  s2.connect(m1);

  // Connect the left side of the parallel chain
  m1.connect(bp.input);
  bp.connect(notch);
  notch.connect(cr);
  cr.connect(m2);

  // Connect the right side of the parallel chain
  m1.connect(m2);

  // Connect the merged result
  m2.connect(ws.input);
  ws.connect(comp);
  comp.connect(eq1.input);
  eq1.connect(eq2);
  eq2.connect(eq3);
  eq3.connect(eq4);
  eq4.connect(lp);
  eq4.connect(bp2);
  lp.connect(m3);
  bp2.connect(m3);
  m3.connect(recorder.input);
  m3.connect(ctx.destination);

  // Adjustments...
  m1.gain.value = 0.5;
  m2.gain.value = 0.5;
  m3.gain.value = 0.75;
  comp.ratio.value = 3.0;
  comp.knee.value = 25;
  comp.threshold.value = -16.0;

  scheduleFilterAutomation(
    bp._filter.frequency,
    8,
    makeRandomGenerator(80, 18000, 3)
  );

  scheduleFilterAutomation(
    notch._filter.frequency,
    4,
    makeRandomGenerator(160, 18000, 2)
  );

  scheduleParallelFilterAutomation(
    lp._filter.frequency,
    bp2._filter.frequency,
    uniformRandInt(2, 16),
    makeRandomGenerator(120, 18000, 2)
  );

  recorder.start();
  play(s1, s2, function(e) {
    recorder.stop(callback);
  });
}

// In step three we can't get away with too much modulation because of how
// much filter movement we introduced in step two. Too much going on here really
// complicates the sound, past the point of a pleasing result, in my opinion.
function stepThree(buffer, callback) {
  var s1 = new Sampler(ctx, buffer);
  var s2 = new Sampler(ctx, buffer, {detune: 5});
  var recorder = new RecorderWrapper(ctx);
  var gain = ctx.createGain();
  var ws = new WaveShaper(ctx, {amount: 0.2});
  var ls = new Filter.Lowshelf(ctx, {
    frequency: 16000,
    gain: -1.0
  });

  gain.gain.value = 0.5;

  s1.connect(gain);
  s2.connect(gain);
  gain.connect(ws.input);
  ws.connect(ls);
  ls.connect(recorder);
  ls.connect(ctx.destination);

  recorder.start();
  play(s1, s2, function(e) {
    recorder.getDownloadFn(callback);
  });
}

// User interface stuff.
document.addEventListener('DOMContentLoaded', function(e) {
  var playButton = document.getElementById('play');
  var downloadButton = document.getElementById('download');
  var _downloadFn = null;
  var _downloadNumber = 0;

  function enable() {
    playButton.removeAttribute('disabled');
    downloadButton.removeAttribute('disabled');
  }

  function disable() {
    playButton.setAttribute('disabled', 'true');
    downloadButton.setAttribute('disabled', 'true');
  }

  function download(e) {
    if (_downloadFn) {
      var name = 'WebAudioNeuroBass' + _downloadNumber++ + '.wav';
      _downloadFn(name);
    }
  }

  function waterfall(e) {
    disable();
    NProgress.start();
    stepOne(function(b1) {
      NProgress.inc();
      stepTwo(b1, function(b2) {
        NProgress.inc();
        stepThree(b2, function(downloadFn) {
          NProgress.done();
          enable();
          _downloadFn = downloadFn;
        });
      });
    });
  }

  playButton.addEventListener('click', waterfall);
  downloadButton.addEventListener('click', download);
});

