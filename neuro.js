(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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


},{"./lib/effects/Chorus":3,"./lib/effects/Filter":4,"./lib/effects/WaveShaper":5,"./lib/generators/Bass":6,"./lib/generators/Sampler":7,"./lib/util/RecorderWrapper":9,"nprogress":10}],2:[function(require,module,exports){
/**
 * An abstract class for custom audio nodes.
 *
 * @param {AudioContext} context
 */

function AbstractNode(context) {
  this.context = context;

  // Convenience assignment
  this.ctx = context;

  // Every node has an input and an output, whether or not they are used.
  this.input = context.createGain();
  this.output = context.createGain();
}

AbstractNode.prototype.connect = function connect(destination) {
  if (typeof destination.input !== 'undefined' &&
      destination.input instanceof AudioNode) {
    return this.output.connect(destination.input);
  }
  if (destination instanceof AudioNode) {
    return this.output.connect(destination);
  }
};

AbstractNode.prototype.disconnect = function disconnect(destination) {
  if (typeof destination.input !== 'undefined' &&
      destination.input instanceof AudioNode) {
    return this.output.disconnect(destination.input);
  }
  if (destination instanceof AudioNode) {
    return this.output.disconnect(destination);
  }
  return this.output.disconnect();
};

AbstractNode.prototype.disable = function disable() {
  this.input.disconnect();
  this.input.connect(this.output);
};

module.exports = AbstractNode;

},{}],3:[function(require,module,exports){
var AbstractNode = require('../AbstractNode');
var LFO = require('../util/LFO');

/**
 * A simple chorus effect implementation.
 *
 * @param {AudioContext} ctx
 */

function Chorus(ctx) {
  AbstractNode.call(this, ctx);
  this.attenuator = ctx.createGain();
  this.split = ctx.createChannelSplitter(2);
  this.leftDelay = ctx.createDelay();
  this.rightDelay = ctx.createDelay();
  this.leftGain = ctx.createGain();
  this.rightGain = ctx.createGain();
  this.merge = ctx.createChannelMerger(2);

  // Routing graph
  this.input.connect(this.attenuator);
  this.attenuator.connect(this.output);
  this.attenuator.connect(this.split);
  this.split.connect(this.leftDelay, 0);
  this.split.connect(this.rightDelay, 0);
  this.leftDelay.connect(this.leftGain);
  this.rightDelay.connect(this.rightGain);
  this.leftGain.connect(this.merge, 0, 0);
  this.rightGain.connect(this.merge, 0, 1);
  this.merge.connect(this.output);

  // Parameters
  this.depth = 0.335 / 1000;
  this.delay = 0.05 / 1000;
  this.attenuator.gain.value = 0.6934;

  // Modulation.
  // Traditionally, a chorus effect will modulate the delayTime
  // on both the left and right channel. For this implementation, I'll get
  // the desired effect only modulating one of them.
  this.lfo = new LFO(ctx, {
    freq: 3.828,
    scale: this.depth / 2
  });

  this.lfo.connect(this.rightDelay.delayTime);
}

Chorus.prototype = Object.create(AbstractNode.prototype, {

  delay: {
    enumerable: true,
    get: function() {
      return this._delay;
    },
    set: function(value) {
      this._delay = value;
      this.leftDelay.delayTime.value = value + this.depth / 2;
      this.rightDelay.delayTime.value = value + this.depth / 2;
    }
  }

});

module.exports = Chorus;

},{"../AbstractNode":2,"../util/LFO":8}],4:[function(require,module,exports){
var AbstractNode = require('../AbstractNode');

/**
 * Filter constructor.
 *
 * @param {AudioContext} context
 * @param {object} opts
 * @param {number} opts.type
 * @param {number} opts.frequency
 * @param {number} opts.Q
 * @param {number} opts.gain
 * @param {number} opts.wet
 * @param {number} opts.dry
 */

function Filter (context, opts) {
  AbstractNode.call(this, context);

  this._filter = context.createBiquadFilter();
  this._dry = context.createGain();
  this._wet = context.createGain();

  var p = this.meta.params;
  opts = opts || {};
  this._type                    = opts.type      || p.type.defaultValue;
  this._filter.frequency.value  = opts.frequency || p.frequency.defaultValue;
  this._filter.Q.value          = opts.Q         || p.Q.defaultValue;
  this._filter.gain.value       = opts.gain      || p.gain.defaultValue;
  this._wet.gain.value          = opts.wet       || p.wet.defaultValue;
  this._dry.gain.value          = opts.dry       || p.dry.defaultValue;
  this._filter.type             = this._type;

  this.input.connect(this._filter);
  this._filter.connect(this._wet);
  this._wet.connect(this.output);

  this.input.connect(this._dry);
  this._dry.connect(this.output);
}

Filter.prototype = Object.create(AbstractNode.prototype, {

  /**
   * Module parameter metadata.
   */

  meta: {
    value: {
      name: "Filter",
      params: {
        type: {
          min: 0,
          max: 7,
          defaultValue: 0,
          type: "int"
        },
        frequency: {
          min: 0,
          max: 22050,
          defaultValue: 8000,
          type: "float"
        },
        Q: {
          min: 0.0001,
          max: 1000,
          defaultValue: 1.0,
          type: "float"
        },
        gain: {
          min: -40,
          max: 40,
          defaultValue: 1,
          type: "float"
        },
        wet: {
          min: 0,
          max: 1,
          defaultValue: 1,
          type: "float"
        },
        dry: {
          min: 0,
          max: 1,
          defaultValue: 0,
          type: "float"
        }
      }
    }
  },

  /**
   * Public parameters.
   */

  type: {
    enumerable: true,
    get: function () { return this._type; },
    set: function (value) {
      this._type = ~~value;
      this._filter.type = ~~value;
    }
  },

  frequency: {
    enumerable: true,
    get: function () { return this._filter.frequency.value; },
    set: function (value) {
      this._filter.frequency.setValueAtTime(value, 0);
    }
  },

  Q: {
    enumerable: true,
    get: function () { return this._filter.Q.value; },
    set: function (value) {
      this._filter.Q.setValueAtTime(value, 0);
    }
  },

  gain: {
    enumerable: true,
    get: function () { return this._filter.gain.value; },
    set: function (value) {
      this._filter.gain.setValueAtTime(value, 0);
    }
  },

  wet: {
    enumerable: true,
    get: function () { return this._wet.gain.value; },
    set: function (value) {
      this._wet.gain.setValueAtTime(value, 0);
    }
  },

  dry: {
    enumerable: true,
    get: function () { return this._dry.gain.value; },
    set: function (value) {
      this._dry.gain.setValueAtTime(value, 0);
    }
  }

});

/**
 * Convenience constructors.
 */

Filter.Lowpass = function (context, opts) {
  opts = opts || {};
  opts.type = 'lowpass';
  return new Filter(context, opts);
};

Filter.Highpass = function (context, opts) {
  opts = opts || {};
  opts.type = 'highpass';
  return new Filter(context, opts);
};

Filter.Bandpass = function (context, opts) {
  opts = opts || {};
  opts.type = 'bandpass';
  return new Filter(context, opts);
};

Filter.Lowshelf = function (context, opts) {
  opts = opts || {};
  opts.type = 'lowshelf';
  return new Filter(context, opts);
};

Filter.Highshelf = function (context, opts) {
  opts = opts || {};
  opts.type = 'highshelf';
  return new Filter(context, opts);
};

Filter.Peaking = function (context, opts) {
  opts = opts || {};
  opts.type = 'peaking';
  return new Filter(context, opts);
};

Filter.Notch = function (context, opts) {
  opts = opts || {};
  opts.type = 'notch';
  return new Filter(context, opts);
};

Filter.Allpass = function (context, opts) {
  opts = opts || {};
  opts.type = 'allpass';
  return new Filter(context, opts);
};

/**
 * Exports.
 */

module.exports = Filter;

},{"../AbstractNode":2}],5:[function(require,module,exports){
var AbstractNode = require('../AbstractNode');

/**
 * WaveShaper node for a hard clipping curve with configurable drive.
 *
 * @param {AudioContext} ctx
 * @param {Object} opts
 * @param {Number} opts.drive
 */

function WaveShaper(ctx, opts) {
  AbstractNode.call(this, ctx);
  this._ws = ctx.createWaveShaper();

  this.drive = opts && opts.drive || 1.0;
  this.amount = opts && opts.amount || 0.5;
  this.input.gain.value = this.drive;
  this.output.gain.value = Math.pow(1.0 / this.drive, 0.6);
  this._setCurve();

  this.input.connect(this._ws);
  this._ws.connect(this.output);
}

WaveShaper.prototype = Object.create(AbstractNode.prototype, {

  _setCurve: {
    value: function() {
      var n = 65536;
      var curve = new Float32Array(n);
      var amt = Math.min(this.amount, 0.9999);
      var k = 2 * amt / (1 - amt);

      for (var i = 0; i < n; i++) {
        var x = (i - (n / 2)) / (n / 2);

        // Identity
        // curve[i] = x;

        curve[i] = (1 + k) * x / (1 + k * Math.abs(x))

        // Hard clipping
        // curve[i] = 0.5 * (Math.abs(x + 0.63) - Math.abs(x - 0.63));

        // Soft clipping
        // curve[i] = Math.tanh(x);

        // Soft clipping cubic approximation
        // curve[i] = x - Math.pow(x, 3) / 4;
      }

      this._ws.curve = curve;
      this._ws.oversample = '2x';
    }
  }

});

module.exports = WaveShaper;

},{"../AbstractNode":2}],6:[function(require,module,exports){
var AbstractNode = require('../AbstractNode');

var teoria = require('teoria');

/**
 * A simple detuned saw pair with a sub sine for those lows.
 *
 * @param {AudioContext} ctx
 */

function Bass(ctx) {
  AbstractNode.call(this, ctx);
  this.detuneRatio = 2.053 / 2;

  this.sawOne = this.ctx.createOscillator();
  this.sawTwo = this.ctx.createOscillator();
  this.sub = this.ctx.createOscillator();

  this.sawOne.type = 'sawtooth';
  this.sawTwo.type = 'sawtooth';

  this.sawGain = this.ctx.createGain();
  this.subGain = this.ctx.createGain();

  this.sawGain.gain.value = 0.36;
  this.subGain.gain.value = 0.18;

  this.sawOne.connect(this.sawGain);
  this.sawTwo.connect(this.sawGain);
  this.sub.connect(this.subGain);

  this.sawGain.connect(this.output);
  this.subGain.connect(this.output);
}

Bass.prototype = Object.create(AbstractNode.prototype, {

  start: {
    value: function(when) {
      this.sawOne.start(when);
      this.sawTwo.start(when);
      this.sub.start(when);
    }
  },

  stop: {
    value: function(when) {
      this.sawOne.stop(when);
      this.sawTwo.stop(when);
      this.sub.stop(when);
    }
  },

  play: {
    value: function(bpm, bars, notes, callback) {
      var beats = 4 * bars;
      var duration = (60 / bpm) * beats;
      var interval = duration / notes.length;
      var timeout = window.setTimeout(callback, 1450);

      this.sawOne.onended = function(e) {
        window.clearTimeout(timeout);
        return callback(e);
      };

      // I'm assuming that the first note here is not a rest.
      var fq = teoria.note(notes[0]).fq();
      this.sub.frequency.setValueAtTime(fq, this.ctx.currentTime);
      this.sawOne.frequency.setValueAtTime(fq, this.ctx.currentTime);
      this.sawTwo.frequency.setValueAtTime(
        fq * this.detuneRatio,
        this.ctx.currentTime
      );

      notes.forEach(function(note, i) {
        if (note === '__') {
          return;
        }
        var fq = teoria.note(note).fq();
        var delta = (i + 1) * interval;
        var t = this.ctx.currentTime + delta;

        this.sub.frequency.exponentialRampToValueAtTime(fq, t);
        this.sawOne.frequency.exponentialRampToValueAtTime(fq, t);
        this.sawTwo.frequency.exponentialRampToValueAtTime(
          fq * this.detuneRatio,
          t
        );
      }, this);

      this.start(0);
      this.stop(this.ctx.currentTime + duration);
    }
  }

});

module.exports = Bass;

},{"../AbstractNode":2,"teoria":11}],7:[function(require,module,exports){
var AbstractNode = require('../AbstractNode');

/**
 * A simple sampler instrument.
 *
 * @param {AudioContext} ctx
 * @param {AudioBuffer} buffer
 * @param {Object} opts
 * @param {Number} opts.detune
 */

function Sampler(ctx, buffer, opts) {
  AbstractNode.call(this, ctx);
  this.source = ctx.createBufferSource();
  this.buffer = buffer;
  this.source.buffer = buffer;
  this.source.detune.value = opts && opts.detune || 0;
  this.source.connect(this.output);
}

Sampler.prototype = Object.create(AbstractNode.prototype, {

  start: {
    value: function(when) {
      this.source.start(when);
    }
  },

  stop: {
    value: function(when) {
      this.source.stop(when);
    }
  },

  play: {
    value: function(callback) {
      var timeout = window.setTimeout(callback, 1450);

      this.source.onended = function(e) {
        window.clearTimeout(timeout);
        return callback(e);
      };

      this.start(0);
      this.stop(this.ctx.currentTime + this.buffer.duration);
    }
  }

});

module.exports = Sampler;

},{"../AbstractNode":2}],8:[function(require,module,exports){
var AbstractNode = require('../AbstractNode');

/**
 * An LFO utility for scaling oscillator output appropriately.
 *
 * The output of the LFO will be on the range [-scale, scale] where scale
 * is the value provided in the options object.
 *
 * Assuming a sine-based LFO is connected to an AudioParam, the value of
 * the AudioParam, A, at time t will be
 *   value = A.value + sin(t) * scale
 *
 * That is to say that the baseline value will be provided by the `.value`
 * property supplied on the target AudioParam. Thus, for example, suppose you
 * want your AudioParam's value to oscillate on the range [0, 100]. In that
 * case, you should set `.value` = 50, and supply a `scale` parameter to the
 * LFO of 50. The computed result then traverses the range [50 - 50, 50 + 50].
 *
 * Another option involves summing two LFOs of the same frequency and oscillator
 * type. Pretty simply, the range [-scale, scale] summed once with itself
 * becomes [0, 2 * scale].
 *
 * @param {AudioContext} context
 * @param {Object} opts
 * @param {Number} opts.scale
 * @param {Number} opts.freq
 * @param {String} opts.type
 */

function LFO(context, opts) {
  AbstractNode.call(this, context);
  this.osc = context.createOscillator();
  this.scale = context.createGain();

  opts = opts || {};
  this.osc.frequency.value = opts.freq || 440;
  this.osc.type = opts.type || 'sine';
  this.scale.gain.value = opts.scale || 1.0;

  this.osc.connect(this.scale);
  this.scale.connect(this.output);

  this.osc.start(0);
}

LFO.prototype = Object.create(AbstractNode.prototype);

module.exports = LFO;

},{"../AbstractNode":2}],9:[function(require,module,exports){
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
    workerPath: 'vendor/recorderWorker.js',
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
  },

  getDownloadFn: {
    value: function(callback) {
      this.recorder.stop();
      return this.recorder.exportWAV(function(blob) {
        return callback(function(filename) {
          Recorder.forceDownload(blob, filename);
        });
      });
    }
  }

});

module.exports = RecorderWrapper;

},{"../AbstractNode":2}],10:[function(require,module,exports){
/* NProgress, (c) 2013, 2014 Rico Sta. Cruz - http://ricostacruz.com/nprogress
 * @license MIT */

;(function(root, factory) {

  if (typeof define === 'function' && define.amd) {
    define(factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.NProgress = factory();
  }

})(this, function() {
  var NProgress = {};

  NProgress.version = '0.2.0';

  var Settings = NProgress.settings = {
    minimum: 0.08,
    easing: 'ease',
    positionUsing: '',
    speed: 200,
    trickle: true,
    trickleRate: 0.02,
    trickleSpeed: 800,
    showSpinner: true,
    barSelector: '[role="bar"]',
    spinnerSelector: '[role="spinner"]',
    parent: 'body',
    template: '<div class="bar" role="bar"><div class="peg"></div></div><div class="spinner" role="spinner"><div class="spinner-icon"></div></div>'
  };

  /**
   * Updates configuration.
   *
   *     NProgress.configure({
   *       minimum: 0.1
   *     });
   */
  NProgress.configure = function(options) {
    var key, value;
    for (key in options) {
      value = options[key];
      if (value !== undefined && options.hasOwnProperty(key)) Settings[key] = value;
    }

    return this;
  };

  /**
   * Last number.
   */

  NProgress.status = null;

  /**
   * Sets the progress bar status, where `n` is a number from `0.0` to `1.0`.
   *
   *     NProgress.set(0.4);
   *     NProgress.set(1.0);
   */

  NProgress.set = function(n) {
    var started = NProgress.isStarted();

    n = clamp(n, Settings.minimum, 1);
    NProgress.status = (n === 1 ? null : n);

    var progress = NProgress.render(!started),
        bar      = progress.querySelector(Settings.barSelector),
        speed    = Settings.speed,
        ease     = Settings.easing;

    progress.offsetWidth; /* Repaint */

    queue(function(next) {
      // Set positionUsing if it hasn't already been set
      if (Settings.positionUsing === '') Settings.positionUsing = NProgress.getPositioningCSS();

      // Add transition
      css(bar, barPositionCSS(n, speed, ease));

      if (n === 1) {
        // Fade out
        css(progress, { 
          transition: 'none', 
          opacity: 1 
        });
        progress.offsetWidth; /* Repaint */

        setTimeout(function() {
          css(progress, { 
            transition: 'all ' + speed + 'ms linear', 
            opacity: 0 
          });
          setTimeout(function() {
            NProgress.remove();
            next();
          }, speed);
        }, speed);
      } else {
        setTimeout(next, speed);
      }
    });

    return this;
  };

  NProgress.isStarted = function() {
    return typeof NProgress.status === 'number';
  };

  /**
   * Shows the progress bar.
   * This is the same as setting the status to 0%, except that it doesn't go backwards.
   *
   *     NProgress.start();
   *
   */
  NProgress.start = function() {
    if (!NProgress.status) NProgress.set(0);

    var work = function() {
      setTimeout(function() {
        if (!NProgress.status) return;
        NProgress.trickle();
        work();
      }, Settings.trickleSpeed);
    };

    if (Settings.trickle) work();

    return this;
  };

  /**
   * Hides the progress bar.
   * This is the *sort of* the same as setting the status to 100%, with the
   * difference being `done()` makes some placebo effect of some realistic motion.
   *
   *     NProgress.done();
   *
   * If `true` is passed, it will show the progress bar even if its hidden.
   *
   *     NProgress.done(true);
   */

  NProgress.done = function(force) {
    if (!force && !NProgress.status) return this;

    return NProgress.inc(0.3 + 0.5 * Math.random()).set(1);
  };

  /**
   * Increments by a random amount.
   */

  NProgress.inc = function(amount) {
    var n = NProgress.status;

    if (!n) {
      return NProgress.start();
    } else {
      if (typeof amount !== 'number') {
        amount = (1 - n) * clamp(Math.random() * n, 0.1, 0.95);
      }

      n = clamp(n + amount, 0, 0.994);
      return NProgress.set(n);
    }
  };

  NProgress.trickle = function() {
    return NProgress.inc(Math.random() * Settings.trickleRate);
  };

  /**
   * Waits for all supplied jQuery promises and
   * increases the progress as the promises resolve.
   *
   * @param $promise jQUery Promise
   */
  (function() {
    var initial = 0, current = 0;

    NProgress.promise = function($promise) {
      if (!$promise || $promise.state() === "resolved") {
        return this;
      }

      if (current === 0) {
        NProgress.start();
      }

      initial++;
      current++;

      $promise.always(function() {
        current--;
        if (current === 0) {
            initial = 0;
            NProgress.done();
        } else {
            NProgress.set((initial - current) / initial);
        }
      });

      return this;
    };

  })();

  /**
   * (Internal) renders the progress bar markup based on the `template`
   * setting.
   */

  NProgress.render = function(fromStart) {
    if (NProgress.isRendered()) return document.getElementById('nprogress');

    addClass(document.documentElement, 'nprogress-busy');
    
    var progress = document.createElement('div');
    progress.id = 'nprogress';
    progress.innerHTML = Settings.template;

    var bar      = progress.querySelector(Settings.barSelector),
        perc     = fromStart ? '-100' : toBarPerc(NProgress.status || 0),
        parent   = document.querySelector(Settings.parent),
        spinner;
    
    css(bar, {
      transition: 'all 0 linear',
      transform: 'translate3d(' + perc + '%,0,0)'
    });

    if (!Settings.showSpinner) {
      spinner = progress.querySelector(Settings.spinnerSelector);
      spinner && removeElement(spinner);
    }

    if (parent != document.body) {
      addClass(parent, 'nprogress-custom-parent');
    }

    parent.appendChild(progress);
    return progress;
  };

  /**
   * Removes the element. Opposite of render().
   */

  NProgress.remove = function() {
    removeClass(document.documentElement, 'nprogress-busy');
    removeClass(document.querySelector(Settings.parent), 'nprogress-custom-parent');
    var progress = document.getElementById('nprogress');
    progress && removeElement(progress);
  };

  /**
   * Checks if the progress bar is rendered.
   */

  NProgress.isRendered = function() {
    return !!document.getElementById('nprogress');
  };

  /**
   * Determine which positioning CSS rule to use.
   */

  NProgress.getPositioningCSS = function() {
    // Sniff on document.body.style
    var bodyStyle = document.body.style;

    // Sniff prefixes
    var vendorPrefix = ('WebkitTransform' in bodyStyle) ? 'Webkit' :
                       ('MozTransform' in bodyStyle) ? 'Moz' :
                       ('msTransform' in bodyStyle) ? 'ms' :
                       ('OTransform' in bodyStyle) ? 'O' : '';

    if (vendorPrefix + 'Perspective' in bodyStyle) {
      // Modern browsers with 3D support, e.g. Webkit, IE10
      return 'translate3d';
    } else if (vendorPrefix + 'Transform' in bodyStyle) {
      // Browsers without 3D support, e.g. IE9
      return 'translate';
    } else {
      // Browsers without translate() support, e.g. IE7-8
      return 'margin';
    }
  };

  /**
   * Helpers
   */

  function clamp(n, min, max) {
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  /**
   * (Internal) converts a percentage (`0..1`) to a bar translateX
   * percentage (`-100%..0%`).
   */

  function toBarPerc(n) {
    return (-1 + n) * 100;
  }


  /**
   * (Internal) returns the correct CSS for changing the bar's
   * position given an n percentage, and speed and ease from Settings
   */

  function barPositionCSS(n, speed, ease) {
    var barCSS;

    if (Settings.positionUsing === 'translate3d') {
      barCSS = { transform: 'translate3d('+toBarPerc(n)+'%,0,0)' };
    } else if (Settings.positionUsing === 'translate') {
      barCSS = { transform: 'translate('+toBarPerc(n)+'%,0)' };
    } else {
      barCSS = { 'margin-left': toBarPerc(n)+'%' };
    }

    barCSS.transition = 'all '+speed+'ms '+ease;

    return barCSS;
  }

  /**
   * (Internal) Queues a function to be executed.
   */

  var queue = (function() {
    var pending = [];
    
    function next() {
      var fn = pending.shift();
      if (fn) {
        fn(next);
      }
    }

    return function(fn) {
      pending.push(fn);
      if (pending.length == 1) next();
    };
  })();

  /**
   * (Internal) Applies css properties to an element, similar to the jQuery 
   * css method.
   *
   * While this helper does assist with vendor prefixed property names, it 
   * does not perform any manipulation of values prior to setting styles.
   */

  var css = (function() {
    var cssPrefixes = [ 'Webkit', 'O', 'Moz', 'ms' ],
        cssProps    = {};

    function camelCase(string) {
      return string.replace(/^-ms-/, 'ms-').replace(/-([\da-z])/gi, function(match, letter) {
        return letter.toUpperCase();
      });
    }

    function getVendorProp(name) {
      var style = document.body.style;
      if (name in style) return name;

      var i = cssPrefixes.length,
          capName = name.charAt(0).toUpperCase() + name.slice(1),
          vendorName;
      while (i--) {
        vendorName = cssPrefixes[i] + capName;
        if (vendorName in style) return vendorName;
      }

      return name;
    }

    function getStyleProp(name) {
      name = camelCase(name);
      return cssProps[name] || (cssProps[name] = getVendorProp(name));
    }

    function applyCss(element, prop, value) {
      prop = getStyleProp(prop);
      element.style[prop] = value;
    }

    return function(element, properties) {
      var args = arguments,
          prop, 
          value;

      if (args.length == 2) {
        for (prop in properties) {
          value = properties[prop];
          if (value !== undefined && properties.hasOwnProperty(prop)) applyCss(element, prop, value);
        }
      } else {
        applyCss(element, args[1], args[2]);
      }
    }
  })();

  /**
   * (Internal) Determines if an element or space separated list of class names contains a class name.
   */

  function hasClass(element, name) {
    var list = typeof element == 'string' ? element : classList(element);
    return list.indexOf(' ' + name + ' ') >= 0;
  }

  /**
   * (Internal) Adds a class to an element.
   */

  function addClass(element, name) {
    var oldList = classList(element),
        newList = oldList + name;

    if (hasClass(oldList, name)) return; 

    // Trim the opening space.
    element.className = newList.substring(1);
  }

  /**
   * (Internal) Removes a class from an element.
   */

  function removeClass(element, name) {
    var oldList = classList(element),
        newList;

    if (!hasClass(element, name)) return;

    // Replace the class name.
    newList = oldList.replace(' ' + name + ' ', ' ');

    // Trim the opening and closing spaces.
    element.className = newList.substring(1, newList.length - 1);
  }

  /**
   * (Internal) Gets a space separated list of the class names on the element. 
   * The list is wrapped with a single space on each end to facilitate finding 
   * matches within the list.
   */

  function classList(element) {
    return (' ' + (element.className || '') + ' ').replace(/\s+/gi, ' ');
  }

  /**
   * (Internal) Removes an element from the DOM.
   */

  function removeElement(element) {
    element && element.parentNode && element.parentNode.removeChild(element);
  }

  return NProgress;
});


},{}],11:[function(require,module,exports){
var Note = require('./lib/note');
var Interval = require('./lib/interval');
var Chord = require('./lib/chord');
var Scale = require('./lib/scale');

// never thought I would write this, but: Legacy support
function intervalConstructor(from, to) {
  // Construct a Interval object from string representation
  if (typeof from === 'string')
    return Interval.toCoord(from);

  if (typeof to === 'string' && from instanceof Note)
    return Interval.from(from, Interval.toCoord(to));

  if (to instanceof Interval && from instanceof Note)
    return Interval.from(from, to);

  if (to instanceof Note && from instanceof Note)
    return Interval.between(from, to);

  throw new Error('Invalid parameters');
}

intervalConstructor.toCoord = Interval.toCoord;
intervalConstructor.from = Interval.from;
intervalConstructor.between = Interval.between;
intervalConstructor.invert = Interval.invert;

function noteConstructor(name, duration) {
  if (typeof name === 'string')
    return Note.fromString(name, duration);
  else
    return new Note(name, duration);
}

noteConstructor.fromString = Note.fromString;
noteConstructor.fromKey = Note.fromKey;
noteConstructor.fromFrequency = Note.fromFrequency;
noteConstructor.fromMIDI = Note.fromMIDI;

function chordConstructor(name, symbol) {
  if (typeof name === 'string') {
    var root, octave;
    root = name.match(/^([a-h])(x|#|bb|b?)/i);
    if (root && root[0]) {
      octave = typeof symbol === 'number' ? symbol.toString(10) : '4';
      return new Chord(Note.fromString(root[0].toLowerCase() + octave),
                            name.substr(root[0].length));
    }
  } else if (name instanceof Note)
    return new Chord(name, symbol);

  throw new Error('Invalid Chord. Couldn\'t find note name');
}

function scaleConstructor(tonic, scale) {
  tonic = (tonic instanceof Note) ? tonic : teoria.note(tonic);
  return new Scale(tonic, scale);
}

var teoria = {
  note: noteConstructor,

  chord: chordConstructor,

  interval: intervalConstructor,

  scale: scaleConstructor,

  Note: Note,
  Chord: Chord,
  Scale: Scale,
  Interval: Interval
};

require('./lib/sugar')(teoria);
exports = module.exports = teoria;

},{"./lib/chord":12,"./lib/interval":13,"./lib/note":15,"./lib/scale":16,"./lib/sugar":17}],12:[function(require,module,exports){
var daccord = require('daccord');
var knowledge = require('./knowledge');
var Note = require('./note');
var Interval = require('./interval');

function Chord(root, name) {
  if (!(this instanceof Chord)) return new Chord(root, name);
  name = name || '';
  this.name = root.name().toUpperCase() + root.accidental() + name;
  this.symbol = name;
  this.root = root;
  this.intervals = [];
  this._voicing = [];

  var bass = name.split('/');
  if (bass.length === 2 && bass[1].trim() !== '9') {
    name = bass[0];
    bass = bass[1].trim();
  } else {
    bass = null;
  }

  this.intervals = daccord(name).map(Interval.toCoord)
  this._voicing = this.intervals.slice();

  if (bass) {
    var intervals = this.intervals, bassInterval, note;
    // Make sure the bass is atop of the root note
    note = Note.fromString(bass + (root.octave() + 1)); // crude

    bassInterval = Interval.between(root, note);
    bass = bassInterval.simple();
    bassInterval = bassInterval.invert().direction('down');

    this._voicing = [bassInterval];
    for (var i = 0, length = intervals.length;  i < length; i++) {
      if (!intervals[i].simple().equal(bass))
        this._voicing.push(intervals[i]);
    }
  }
}

Chord.prototype = {
  notes: function() {
    var root = this.root;
    return this.voicing().map(function(interval) {
      return root.interval(interval);
    });
  },

  simple: function() {
    return this.notes().map(function(n) { return n.toString(true); });
  },

  bass: function() {
    return this.root.interval(this._voicing[0]);
  },

  voicing: function(voicing) {
    // Get the voicing
    if (!voicing) {
      return this._voicing;
    }

    // Set the voicing
    this._voicing = [];
    for (var i = 0, length = voicing.length; i < length; i++) {
      this._voicing[i] = Interval.toCoord(voicing[i]);
    }

    return this;
  },

  resetVoicing: function() {
    this._voicing = this.intervals;
  },

  dominant: function(additional) {
    additional = additional || '';
    return new Chord(this.root.interval('P5'), additional);
  },

  subdominant: function(additional) {
    additional = additional || '';
    return new Chord(this.root.interval('P4'), additional);
  },

  parallel: function(additional) {
    additional = additional || '';
    var quality = this.quality();

    if (this.chordType() !== 'triad' || quality === 'diminished' ||
        quality === 'augmented') {
      throw new Error('Only major/minor triads have parallel chords');
    }

    if (quality === 'major') {
      return new Chord(this.root.interval('m3', 'down'), 'm');
    } else {
      return new Chord(this.root.interval('m3', 'up'));
    }
  },

  quality: function() {
    var third, fifth, seventh, intervals = this.intervals;

    for (var i = 0, length = intervals.length; i < length; i++) {
      if (intervals[i].number() === 3) {
        third = intervals[i];
      } else if (intervals[i].number() === 5) {
        fifth = intervals[i];
      } else if (intervals[i].number() === 7) {
        seventh = intervals[i];
      }
    }

    if (!third) {
      return;
    }

    third = (third.direction() === 'down') ? third.invert() : third;
    third = third.simple().toString();

    if (fifth) {
      fifth = (fifth.direction === 'down') ? fifth.invert() : fifth;
      fifth = fifth.simple().toString();
    }

    if (seventh) {
      seventh = (seventh.direction === 'down') ? seventh.invert() : seventh;
      seventh = seventh.simple().toString();
    }

    if (third === 'M3') {
      if (fifth === 'A5') {
        return 'augmented';
      } else if (fifth === 'P5') {
        return (seventh === 'm7') ? 'dominant' : 'major';
      }

      return 'major';
    } else if (third === 'm3') {
      if (fifth === 'P5') {
        return 'minor';
      } else if (fifth === 'd5') {
        return (seventh === 'm7') ? 'half-diminished' : 'diminished';
      }

      return 'minor';
    }
  },

  chordType: function() { // In need of better name
    var length = this.intervals.length, interval, has, invert, i, name;

    if (length === 2) {
      return 'dyad';
    } else if (length === 3) {
      has = {first: false, third: false, fifth: false};
      for (i = 0; i < length; i++) {
        interval = this.intervals[i];
        invert = interval.invert();
        if (interval.base() in has) {
          has[interval.base()] = true;
        } else if (invert.base() in has) {
          has[invert.base()] = true;
        }
      }

      name = (has.first && has.third && has.fifth) ? 'triad' : 'trichord';
    } else if (length === 4) {
      has = {first: false, third: false, fifth: false, seventh: false};
      for (i = 0; i < length; i++) {
        interval = this.intervals[i];
        invert = interval.invert();
        if (interval.base() in has) {
          has[interval.base()] = true;
        } else if (invert.base() in has) {
          has[invert.base()] = true;
        }
      }

      if (has.first && has.third && has.fifth && has.seventh) {
        name = 'tetrad';
      }
    }

    return name || 'unknown';
  },

  get: function(interval) {
    if (typeof interval === 'string' && interval in knowledge.stepNumber) {
      var intervals = this.intervals, i, length;

      interval = knowledge.stepNumber[interval];
      for (i = 0, length = intervals.length; i < length; i++) {
        if (intervals[i].number() === interval) {
          return this.root.interval(intervals[i]);
        }
      }

      return null;
    } else {
      throw new Error('Invalid interval name');
    }
  },

  interval: function(interval) {
    return new Chord(this.root.interval(interval), this.symbol);
  },

  transpose: function(interval) {
    this.root.transpose(interval);
    this.name = this.root.name().toUpperCase() +
                this.root.accidental() + this.symbol;

    return this;
  },

  toString: function() {
    return this.name;
  }
};

module.exports = Chord;

},{"./interval":13,"./knowledge":14,"./note":15,"daccord":19}],13:[function(require,module,exports){
var knowledge = require('./knowledge');
var vector = require('./vector');
var toCoord = require('interval-coords');

function Interval(coord) {
  if (!(this instanceof Interval)) return new Interval(coord);
  this.coord = coord;
}

Interval.prototype = {
  name: function() {
    return knowledge.intervalsIndex[this.number() - 1];
  },

  semitones: function() {
    return vector.sum(vector.mul(this.coord, [12, 7]));
  },

  number: function() {
    return Math.abs(this.value());
  },

  value: function() {
    var without = vector.sub(this.coord,
      vector.mul(knowledge.sharp, Math.floor((this.coord[1] - 2) / 7) + 1))
      , i, val;

    i = knowledge.intervalFromFifth[without[1] + 5];
    val = knowledge.stepNumber[i] + (without[0] - knowledge.intervals[i][0]) * 7;

    return (val > 0) ? val : val - 2;
  },

  type: function() {
    return knowledge.intervals[this.base()][0] <= 1 ? 'perfect' : 'minor';
  },

  base: function() {
    var fifth = vector.sub(this.coord, vector.mul(knowledge.sharp, this.qualityValue()))[1], name;
    fifth = this.value() > 0 ? fifth + 5 : -(fifth - 5) % 7;
    fifth = fifth < 0 ? knowledge.intervalFromFifth.length + fifth : fifth;

    name = knowledge.intervalFromFifth[fifth];
    if (name === 'unison' && this.number() >= 8)
      name = 'octave';

    return name;
  },

  direction: function(dir) {
    if (dir) {
      var is = this.value() >= 1 ? 'up' : 'down';
      if (is !== dir)
        this.coord = vector.mul(this.coord, -1);

      return this;
    }
    else
      return this.value() >= 1 ? 'up' : 'down';
  },

  simple: function(ignore) {
    // Get the (upwards) base interval (with quality)
    var simple = knowledge.intervals[this.base()];
    simple = vector.add(simple, vector.mul(knowledge.sharp, this.qualityValue()));

    // Turn it around if necessary
    if (!ignore)
      simple = this.direction() === 'down' ? vector.mul(simple, -1) : simple;

    return new Interval(simple);
  },

  isCompound: function() {
    return this.number() > 8;
  },

  octaves: function() {
    var without, octaves;

    if (this.direction() === 'up') {
      without = vector.sub(this.coord, vector.mul(knowledge.sharp, this.qualityValue()));
      octaves = without[0] - knowledge.intervals[this.base()][0];
    } else {
      without = vector.sub(this.coord, vector.mul(knowledge.sharp, -this.qualityValue()));
      octaves = -(without[0] + knowledge.intervals[this.base()][0]);
    }

    return octaves;
  },

  invert: function() {
    var i = this.base();
    var qual = this.qualityValue();
    var acc = this.type() === 'minor' ? -(qual - 1) : -qual;
    var coord = knowledge.intervals[knowledge.intervalsIndex[9 - knowledge.stepNumber[i] - 1]];
    coord = vector.add(coord, vector.mul(knowledge.sharp, acc));

    return new Interval(coord);
  },

  quality: function(lng) {
    var quality = knowledge.alterations[this.type()][this.qualityValue() + 2];

    return lng ? knowledge.qualityLong[quality] : quality;
  },

  qualityValue: function() {
    if (this.direction() === 'down')
      return Math.floor((-this.coord[1] - 2) / 7) + 1;
    else
      return Math.floor((this.coord[1] - 2) / 7) + 1;
  },

  equal: function(interval) {
      return this.coord[0] === interval.coord[0] &&
          this.coord[1] === interval.coord[1];
  },

  greater: function(interval) {
    var semi = this.semitones();
    var isemi = interval.semitones();

    // If equal in absolute size, measure which interval is bigger
    // For example P4 is bigger than A3
    return (semi === isemi) ?
      (this.number() > interval.number()) : (semi > isemi);
  },

  smaller: function(interval) {
    return !this.equal(interval) && !this.greater(interval);
  },

  add: function(interval) {
    return new Interval(vector.add(this.coord, interval.coord));
  },

  toString: function(ignore) {
    // If given true, return the positive value
    var number = ignore ? this.number() : this.value();

    return this.quality() + number;
  }
}

Interval.toCoord = function(simple) {
  var coord = toCoord(simple);
  if (!coord)
    throw new Error('Invalid simple format interval');

  return new Interval(coord);
}

Interval.from = function(from, to) {
  return from.interval(to);
}

Interval.between = function(from, to) {
  return new Interval(vector.sub(to.coord, from.coord));
}

Interval.invert = function(sInterval) {
  return Interval.toCoord(sInterval).invert().toString();
}

module.exports = Interval;

},{"./knowledge":14,"./vector":18,"interval-coords":23}],14:[function(require,module,exports){
// Note coordinates [octave, fifth] relative to C
module.exports = {
  notes: {
    c: [0, 0],
    d: [-1, 2],
    e: [-2, 4],
    f: [1, -1],
    g: [0, 1],
    a: [-1, 3],
    b: [-2, 5],
    h: [-2, 5]
  },

  intervals: {
    unison: [0, 0],
    second: [3, -5],
    third: [2, -3],
    fourth: [1, -1],
    fifth: [0, 1],
    sixth: [3, -4],
    seventh: [2, -2],
    octave: [1, 0]
  },

  intervalFromFifth: ['second', 'sixth', 'third', 'seventh', 'fourth',
                         'unison', 'fifth'],

  intervalsIndex: ['unison', 'second', 'third', 'fourth', 'fifth',
                      'sixth', 'seventh', 'octave', 'ninth', 'tenth',
                      'eleventh', 'twelfth', 'thirteenth', 'fourteenth',
                      'fifteenth'],

// linaer index to fifth = (2 * index + 1) % 7
  fifths: ['f', 'c', 'g', 'd', 'a', 'e', 'b'],
  accidentals: ['bb', 'b', '', '#', 'x'],

  sharp: [-4, 7],
  A4: [3, 3],

  durations: {
    '0.25': 'longa',
    '0.5': 'breve',
    '1': 'whole',
    '2': 'half',
    '4': 'quarter',
    '8': 'eighth',
    '16': 'sixteenth',
    '32': 'thirty-second',
    '64': 'sixty-fourth',
    '128': 'hundred-twenty-eighth'
  },

  qualityLong: {
    P: 'perfect',
    M: 'major',
    m: 'minor',
    A: 'augmented',
    AA: 'doubly augmented',
    d: 'diminished',
    dd: 'doubly diminished'
  },

  alterations: {
    perfect: ['dd', 'd', 'P', 'A', 'AA'],
    minor: ['dd', 'd', 'm', 'M', 'A', 'AA']
  },

  symbols: {
    'min': ['m3', 'P5'],
    'm': ['m3', 'P5'],
    '-': ['m3', 'P5'],

    'M': ['M3', 'P5'],
    '': ['M3', 'P5'],

    '+': ['M3', 'A5'],
    'aug': ['M3', 'A5'],

    'dim': ['m3', 'd5'],
    'o': ['m3', 'd5'],

    'maj': ['M3', 'P5', 'M7'],
    'dom': ['M3', 'P5', 'm7'],
    'ø': ['m3', 'd5', 'm7'],

    '5': ['P5']
  },

  chordShort: {
    'major': 'M',
    'minor': 'm',
    'augmented': 'aug',
    'diminished': 'dim',
    'half-diminished': '7b5',
    'power': '5',
    'dominant': '7'
  },

  stepNumber: {
    'unison': 1,
    'first': 1,
    'second': 2,
    'third': 3,
    'fourth': 4,
    'fifth': 5,
    'sixth': 6,
    'seventh': 7,
    'octave': 8,
    'ninth': 9,
    'eleventh': 11,
    'thirteenth': 13
  },

  // Adjusted Shearer syllables - Chromatic solfege system
  // Some intervals are not provided for. These include:
  // dd2 - Doubly diminished second
  // dd3 - Doubly diminished third
  // AA3 - Doubly augmented third
  // dd6 - Doubly diminished sixth
  // dd7 - Doubly diminished seventh
  // AA7 - Doubly augmented seventh
  intervalSolfege: {
    'dd1': 'daw',
    'd1': 'de',
    'P1': 'do',
    'A1': 'di',
    'AA1': 'dai',
    'd2': 'raw',
    'm2': 'ra',
    'M2': 're',
    'A2': 'ri',
    'AA2': 'rai',
    'd3': 'maw',
    'm3': 'me',
    'M3': 'mi',
    'A3': 'mai',
    'dd4': 'faw',
    'd4': 'fe',
    'P4': 'fa',
    'A4': 'fi',
    'AA4': 'fai',
    'dd5': 'saw',
    'd5': 'se',
    'P5': 'so',
    'A5': 'si',
    'AA5': 'sai',
    'd6': 'law',
    'm6': 'le',
    'M6': 'la',
    'A6': 'li',
    'AA6': 'lai',
    'd7': 'taw',
    'm7': 'te',
    'M7': 'ti',
    'A7': 'tai',
    'dd8': 'daw',
    'd8': 'de',
    'P8': 'do',
    'A8': 'di',
    'AA8': 'dai'
  }
}

},{}],15:[function(require,module,exports){
var scientific = require('scientific-notation');
var helmholtz = require('helmholtz');
var knowledge = require('./knowledge');
var vector = require('./vector');
var Interval = require('./interval');

function pad(str, ch, len) {
  for (; len > 0; len--) {
    str += ch;
  }

  return str;
}


function Note(coord, duration) {
  if (!(this instanceof Note)) return new Note(coord, duration);
  duration = duration || {};

  this.duration = { value: duration.value || 4, dots: duration.dots || 0 };
  this.coord = coord;
}

Note.prototype = {
  octave: function() {
    return this.coord[0] + knowledge.A4[0] - knowledge.notes[this.name()][0] +
      this.accidentalValue() * 4;
  },

  name: function() {
    return knowledge.fifths[this.coord[1] + knowledge.A4[1] - this.accidentalValue() * 7 + 1];
  },

  accidentalValue: function() {
    return Math.round((this.coord[1] + knowledge.A4[1] - 2) / 7);
  },

  accidental: function() {
    return knowledge.accidentals[this.accidentalValue() + 2];
  },

  /**
   * Returns the key number of the note
   */
  key: function(white) {
    if (white)
      return this.coord[0] * 7 + this.coord[1] * 4 + 29;
    else
      return this.coord[0] * 12 + this.coord[1] * 7 + 49;
  },

  /**
  * Returns a number ranging from 0-127 representing a MIDI note value
  */
  midi: function() {
    return this.key() + 20;
  },

  /**
   * Calculates and returns the frequency of the note.
   * Optional concert pitch (def. 440)
   */
  fq: function(concertPitch) {
    concertPitch = concertPitch || 440;

    return concertPitch *
      Math.pow(2, (this.coord[0] * 12 + this.coord[1] * 7) / 12);
  },

  /**
   * Returns the pitch class index (chroma) of the note
   */
  chroma: function() {
    var value = (vector.sum(vector.mul(this.coord, [12, 7])) - 3) % 12;

    return (value < 0) ? value + 12 : value;
  },

  interval: function(interval) {
    if (typeof interval === 'string') interval = Interval.toCoord(interval);

    if (interval instanceof Interval)
      return new Note(vector.add(this.coord, interval.coord));
    else if (interval instanceof Note)
      return new Interval(vector.sub(interval.coord, this.coord));
  },

  transpose: function(interval) {
    this.coord = vector.add(this.coord, interval.coord);
    return this;
  },

  /**
   * Returns the Helmholtz notation form of the note (fx C,, d' F# g#'')
   */
  helmholtz: function() {
    var octave = this.octave();
    var name = this.name();
    name = octave < 3 ? name.toUpperCase() : name.toLowerCase();
    var padchar = octave < 3 ? ',' : '\'';
    var padcount = octave < 2 ? 2 - octave : octave - 3;

    return pad(name + this.accidental(), padchar, padcount);
  },

  /**
   * Returns the scientific notation form of the note (fx E4, Bb3, C#7 etc.)
   */
  scientific: function() {
    return this.name().toUpperCase() + this.accidental() + this.octave();
  },

  /**
   * Returns notes that are enharmonic with this note.
   */
  enharmonics: function(oneaccidental) {
    var key = this.key(), limit = oneaccidental ? 2 : 3;

    return ['m3', 'm2', 'm-2', 'm-3']
      .map(this.interval.bind(this))
      .filter(function(note) {
      var acc = note.accidentalValue();
      var diff = key - (note.key() - acc);

      if (diff < limit && diff > -limit) {
        note.coord = vector.add(note.coord, vector.mul(knowledge.sharp, diff - acc));
        return true;
      }
    });
  },

  solfege: function(scale, showOctaves) {
    var interval = scale.tonic.interval(this), solfege, stroke, count;
    if (interval.direction() === 'down')
      interval = interval.invert();

    if (showOctaves) {
      count = (this.key(true) - scale.tonic.key(true)) / 7;
      count = (count >= 0) ? Math.floor(count) : -(Math.ceil(-count));
      stroke = (count >= 0) ? '\'' : ',';
    }

    solfege = knowledge.intervalSolfege[interval.simple(true).toString()];
    return (showOctaves) ? pad(solfege, stroke, Math.abs(count)) : solfege;
  },

  scaleDegree: function(scale) {
    var inter = scale.tonic.interval(this);

    // If the direction is down, or we're dealing with an octave - invert it
    if (inter.direction() === 'down' ||
       (inter.coord[1] === 0 && inter.coord[0] !== 0)) {
      inter = inter.invert();
    }

    inter = inter.simple(true).coord;

    return scale.scale.reduce(function(index, current, i) {
      var coord = Interval.toCoord(current).coord;
      return coord[0] === inter[0] && coord[1] === inter[1] ? i + 1 : index;
    }, 0);
  },

  /**
   * Returns the name of the duration value,
   * such as 'whole', 'quarter', 'sixteenth' etc.
   */
  durationName: function() {
    return knowledge.durations[this.duration.value];
  },

  /**
   * Returns the duration of the note (including dots)
   * in seconds. The first argument is the tempo in beats
   * per minute, the second is the beat unit (i.e. the
   * lower numeral in a time signature).
   */
  durationInSeconds: function(bpm, beatUnit) {
    var secs = (60 / bpm) / (this.duration.value / 4) / (beatUnit / 4);
    return secs * 2 - secs / Math.pow(2, this.duration.dots);
  },

  /**
   * Returns the name of the note, with an optional display of octave number
   */
  toString: function(dont) {
    return this.name() + this.accidental() + (dont ? '' : this.octave());
  }
};

Note.fromString = function(name, dur) {
  var coord = scientific(name);
  if (!coord) coord = helmholtz(name);
  return new Note(coord, dur);
}

Note.fromKey = function(key) {
  var octave = Math.floor((key - 4) / 12);
  var distance = key - (octave * 12) - 4;
  var name = knowledge.fifths[(2 * Math.round(distance / 2) + 1) % 7];
  var note = vector.add(vector.sub(knowledge.notes[name], knowledge.A4), [octave + 1, 0]);
  var diff = (key - 49) - vector.sum(vector.mul(note, [12, 7]));

  return new Note(diff ? vector.add(note, vector.mul(knowledge.sharp, diff)) : note);
}

Note.fromFrequency = function(fq, concertPitch) {
  var key, cents, originalFq;
  concertPitch = concertPitch || 440;

  key = 49 + 12 * ((Math.log(fq) - Math.log(concertPitch)) / Math.log(2));
  key = Math.round(key);
  originalFq = concertPitch * Math.pow(2, (key - 49) / 12);
  cents = 1200 * (Math.log(fq / originalFq) / Math.log(2));

  return { note: Note.fromKey(key), cents: cents };
}

Note.fromMIDI = function(note) {
  return Note.fromKey(note - 20);
}

module.exports = Note;

},{"./interval":13,"./knowledge":14,"./vector":18,"helmholtz":20,"scientific-notation":24}],16:[function(require,module,exports){
var knowledge = require('./knowledge');
var Interval = require('./interval');

var scales = {
  aeolian: ['P1', 'M2', 'm3', 'P4', 'P5', 'm6', 'm7'],
  blues: ['P1', 'm3', 'P4', 'A4', 'P5', 'm7'],
  chromatic: ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7'],
  dorian: ['P1', 'M2', 'm3', 'P4', 'P5', 'M6', 'm7'],
  doubleharmonic: ['P1', 'm2', 'M3', 'P4', 'P5', 'm6', 'M7'],
  harmonicminor: ['P1', 'M2', 'm3', 'P4', 'P5', 'm6', 'M7'],
  ionian: ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'M7'],
  locrian: ['P1', 'm2', 'm3', 'P4', 'd5', 'm6', 'm7'],
  lydian: ['P1', 'M2', 'M3', 'A4', 'P5', 'M6', 'M7'],
  majorpentatonic: ['P1', 'M2', 'M3', 'P5', 'M6'],
  melodicminor: ['P1', 'M2', 'm3', 'P4', 'P5', 'M6', 'M7'],
  minorpentatonic: ['P1', 'm3', 'P4', 'P5', 'm7'],
  mixolydian: ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'm7'],
  phrygian: ['P1', 'm2', 'm3', 'P4', 'P5', 'm6', 'm7']
}

// synonyms
scales.harmonicchromatic = scales.chromatic;
scales.minor = scales.aeolian;
scales.major = scales.ionian;
scales.flamenco = scales.doubleharmonic;

function Scale(tonic, scale) {
  if (!(this instanceof Scale)) return new Scale(tonic, scale);
  var scaleName, i;
  if (!('coord' in tonic)) {
    throw new Error('Invalid Tonic');
  }

  if (typeof scale === 'string') {
    scaleName = scale;
    scale = scales[scale];
    if (!scale)
      throw new Error('Invalid Scale');
  } else {
    for (i in scales) {
      if (scales.hasOwnProperty(i)) {
        if (scales[i].toString() === scale.toString()) {
          scaleName = i;
          break;
        }
      }
    }
  }

  this.name = scaleName;
  this.tonic = tonic;
  this.scale = scale;
}

Scale.prototype = {
  notes: function() {
    var notes = [];

    for (var i = 0, length = this.scale.length; i < length; i++) {
      notes.push(this.tonic.interval(this.scale[i]));
    }

    return notes;
  },

  simple: function() {
    return this.notes().map(function(n) { return n.toString(true); });
  },

  type: function() {
    var length = this.scale.length - 2;
    if (length < 8) {
      return ['di', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa'][length] +
        'tonic';
    }
  },

  get: function(i) {
    i = (typeof i === 'string' && i in knowledge.stepNumber) ? knowledge.stepNumber[i] : i;

    return this.tonic.interval(this.scale[i - 1]);
  },

  solfege: function(index, showOctaves) {
    if (index)
      return this.get(index).solfege(this, showOctaves);

    return this.notes().map(function(n) {
      return n.solfege(this, showOctaves);
    });
  },

  interval: function(interval) {
    interval = (typeof interval === 'string') ?
      Interval.toCoord(interval) : interval;
    return new Scale(this.tonic.interval(interval), this.scale);
  },

  transpose: function(interval) {
    var scale = this.interval(interval);
    this.scale = scale.scale;
    this.tonic = scale.tonic;

    return this;
  }
};

module.exports = Scale;

},{"./interval":13,"./knowledge":14}],17:[function(require,module,exports){
var knowledge = require('./knowledge');

module.exports = function(teoria) {
  var Note = teoria.Note;
  var Chord = teoria.Chord;
  var Scale = teoria.Scale;

  Note.prototype.chord = function(chord) {
    chord = (chord in knowledge.chordShort) ? knowledge.chordShort[chord] : chord;

    return new Chord(this, chord);
  }

  Note.prototype.scale = function(scale) {
    return new Scale(this, scale);
  }
}

},{"./knowledge":14}],18:[function(require,module,exports){
module.exports = {
  add: function(note, interval) {
    return [note[0] + interval[0], note[1] + interval[1]];
  },

  sub: function(note, interval) {
    return [note[0] - interval[0], note[1] - interval[1]];
  },

  mul: function(note, interval) {
    if (typeof interval === 'number')
      return [note[0] * interval, note[1] * interval];
    else
      return [note[0] * interval[0], note[1] * interval[1]];
  },

  sum: function(coord) {
    return coord[0] + coord[1];
  }
}

},{}],19:[function(require,module,exports){
var SYMBOLS = {
  'm': ['m3', 'P5'],
  'mi': ['m3', 'P5'],
  'min': ['m3', 'P5'],
  '-': ['m3', 'P5'],

  'M': ['M3', 'P5'],
  'ma': ['M3', 'P5'],
  '': ['M3', 'P5'],

  '+': ['M3', 'A5'],
  'aug': ['M3', 'A5'],

  'dim': ['m3', 'd5'],
  'o': ['m3', 'd5'],

  'maj': ['M3', 'P5', 'M7'],
  'dom': ['M3', 'P5', 'm7'],
  'ø': ['m3', 'd5', 'm7'],

  '5': ['P5'],

  '6/9': ['M3', 'P5', 'M6', 'M9']
};

module.exports = function(symbol) {
  var c, parsing = 'quality', additionals = [], name, chordLength = 2
  var notes = ['P1', 'M3', 'P5', 'm7', 'M9', 'P11', 'M13'];
  var explicitMajor = false;

  function setChord(name) {
    var intervals = SYMBOLS[name];
    for (var i = 0, len = intervals.length; i < len; i++) {
      notes[i + 1] = intervals[i];
    }

    chordLength = intervals.length;
  }

  // Remove whitespace, commas and parentheses
  symbol = symbol.replace(/[,\s\(\)]/g, '');
  for (var i = 0, len = symbol.length; i < len; i++) {
    if (!(c = symbol[i]))
      return;

    if (parsing === 'quality') {
      var sub3 = (i + 2) < len ? symbol.substr(i, 3).toLowerCase() : null;
      var sub2 = (i + 1) < len ? symbol.substr(i, 2).toLowerCase() : null;
      if (sub3 in SYMBOLS)
        name = sub3;
      else if (sub2 in SYMBOLS)
        name = sub2;
      else if (c in SYMBOLS)
        name = c;
      else
        name = '';

      if (name)
        setChord(name);

      if (name === 'M' || name === 'ma' || name === 'maj')
        explicitMajor = true;


      i += name.length - 1;
      parsing = 'extension';
    } else if (parsing === 'extension') {
      c = (c === '1' && symbol[i + 1]) ? +symbol.substr(i, 2) : +c;

      if (!isNaN(c) && c !== 6) {
        chordLength = (c - 1) / 2;

        if (chordLength !== Math.round(chordLength))
          return new Error('Invalid interval extension: ' + c.toString(10));

        if (name === 'o' || name === 'dim')
          notes[3] = 'd7';
        else if (explicitMajor)
          notes[3] = 'M7';

        i += c >= 10 ? 1 : 0;
      } else if (c === 6) {
        notes[3] = 'M6';
        chordLength = Math.max(3, chordLength);
      } else
        i -= 1;

      parsing = 'alterations';
    } else if (parsing === 'alterations') {
      var alterations = symbol.substr(i).split(/(#|b|add|maj|sus|M)/i),
          next, flat = false, sharp = false;

      if (alterations.length === 1)
        return new Error('Invalid alteration');
      else if (alterations[0].length !== 0)
        return new Error('Invalid token: \'' + alterations[0] + '\'');

      var ignore = false;
      alterations.forEach(function(alt, i, arr) {
        if (ignore || !alt.length)
          return ignore = false;

        var next = arr[i + 1], lower = alt.toLowerCase();
        if (alt === 'M' || lower === 'maj') {
          if (next === '7')
            ignore = true;

          chordLength = Math.max(3, chordLength);
          notes[3] = 'M7';
        } else if (lower === 'sus') {
          var type = 'P4';
          if (next === '2' || next === '4') {
            ignore = true;

            if (next === '2')
              type = 'M2';
          }

          notes[1] = type; // Replace third with M2 or P4
        } else if (lower === 'add') {
          if (next === '9')
            additionals.push('M9');
          else if (next === '11')
            additionals.push('P11');
          else if (next === '13')
            additionals.push('M13');

          ignore = true
        } else if (lower === 'b') {
          flat = true;
        } else if (lower === '#') {
          sharp = true;
        } else {
          var token = +alt, quality, intPos;
          if (isNaN(token) || String(token).length !== alt.length)
            return new Error('Invalid token: \'' + alt + '\'');

          if (token === 6) {
            if (sharp)
              notes[3] = 'A6';
            else if (flat)
              notes[3] = 'm6';
            else
              notes[3] = 'M6';

            chordLength = Math.max(3, chordLength);
            return;
          }

          // Calculate the position in the 'note' array
          intPos = (token - 1) / 2;
          if (chordLength < intPos)
            chordLength = intPos;

          if (token < 5 || token === 7 || intPos !== Math.round(intPos))
            return new Error('Invalid interval alteration: ' + token);

          quality = notes[intPos][0];

          // Alterate the quality of the interval according the accidentals
          if (sharp) {
            if (quality === 'd')
              quality = 'm';
            else if (quality === 'm')
              quality = 'M';
            else if (quality === 'M' || quality === 'P')
              quality = 'A';
          } else if (flat) {
            if (quality === 'A')
              quality = 'M';
            else if (quality === 'M')
              quality = 'm';
            else if (quality === 'm' || quality === 'P')
              quality = 'd';
          }

          sharp = flat = false;
          notes[intPos] = quality + token;
        }
      });
      parsing = 'ended';
    } else if (parsing === 'ended') {
      break;
    }
  }

  return notes.slice(0, chordLength + 1).concat(additionals);
}

},{}],20:[function(require,module,exports){
var coords = require('notecoord');
var accval = require('accidental-value');

module.exports = function helmholtz(name) {
  var name = name.replace(/\u2032/g, "'").replace(/\u0375/g, ',');
  var parts = name.match(/^(,*)([a-h])(x|#|bb|b?)([,\']*)$/i);

  if (!parts || name !== parts[0])
    throw new Error('Invalid formatting');

  var note = parts[2];
  var octaveFirst = parts[1];
  var octaveLast = parts[4];
  var lower = note === note.toLowerCase();
  var octave;

  if (octaveFirst) {
    if (lower)
      throw new Error('Invalid formatting - found commas before lowercase note');

    octave = 2 - octaveFirst.length;
  } else if (octaveLast) {
    if (octaveLast.match(/^'+$/) && lower)
      octave = 3 + octaveLast.length;
    else if (octaveLast.match(/^,+$/) && !lower)
      octave = 2 - octaveLast.length;
    else
      throw new Error('Invalid formatting - mismatch between octave ' +
        'indicator and letter case')
  } else
    octave = lower ? 3 : 2;

  var accidentalValue = accval.interval(parts[3].toLowerCase());
  var coord = coords(note.toLowerCase());

  coord[0] += octave;
  coord[0] += accidentalValue[0] - coords.A4[0];
  coord[1] += accidentalValue[1] - coords.A4[1];

  return coord;
};

},{"accidental-value":21,"notecoord":22}],21:[function(require,module,exports){
var accidentalValues = {
  'bb': -2,
  'b': -1,
  '': 0,
  '#': 1,
  'x': 2
};

module.exports = function accidentalNumber(acc) {
  return accidentalValues[acc];
}

module.exports.interval = function accidentalInterval(acc) {
  var val = accidentalValues[acc];
  return [-4 * val, 7 * val];
}

},{}],22:[function(require,module,exports){
// First coord is octaves, second is fifths. Distances are relative to c
var notes = {
  c: [0, 0],
  d: [-1, 2],
  e: [-2, 4],
  f: [1, -1],
  g: [0, 1],
  a: [-1, 3],
  b: [-2, 5],
  h: [-2, 5]
};

module.exports = function(name) {
  return name in notes ? [notes[name][0], notes[name][1]] : null;
};

module.exports.notes = notes;
module.exports.A4 = [3, 3]; // Relative to C0 (scientic notation, ~16.35Hz)
module.exports.sharp = [-4, 7];

},{}],23:[function(require,module,exports){
var pattern = /^(AA|A|P|M|m|d|dd)(-?\d+)$/;

// The interval it takes to raise a note a semitone
var sharp = [-4, 7];

var pAlts = ['dd', 'd', 'P', 'A', 'AA'];
var mAlts = ['dd', 'd', 'm', 'M', 'A', 'AA'];

var baseIntervals = [
  [0, 0],
  [3, -5],
  [2, -3],
  [1, -1],
  [0, 1],
  [3, -4],
  [2, -2],
  [1, 0]
];

module.exports = function(simple) {
  var parser = simple.match(pattern);
  if (!parser) return null;

  var quality = parser[1];
  var number = +parser[2];
  var sign = number < 0 ? -1 : 1;

  number = sign < 0 ? -number : number;

  var lower = number > 8 ? (number % 7 || 7) : number;
  var octaves = (number - lower) / 7;

  var base = baseIntervals[lower - 1];
  var alts = base[0] <= 1 ? pAlts : mAlts;
  var alt = alts.indexOf(quality) - 2;

  // this happens, if the alteration wasn't suitable for this type
  // of interval, such as P2 or M5 (no "perfect second" or "major fifth")
  if (alt === -3) return null;

  return [
    sign * (base[0] + octaves + sharp[0] * alt),
    sign * (base[1] + sharp[1] * alt)
  ];
}

// Copy to avoid overwriting internal base intervals
module.exports.coords = baseIntervals.slice(0);

},{}],24:[function(require,module,exports){
var coords = require('notecoord');
var accval = require('accidental-value');

module.exports = function scientific(name) {
  var format = /^([a-h])(x|#|bb|b?)(-?\d*)/i;

  parser = name.match(format);
  if (!(parser && name === parser[0] && parser[3].length)) return;

  var noteName = parser[1];
  var octave = +parser[3];
  var accidental = parser[2].length ? parser[2].toLowerCase() : '';

  var accidentalValue = accval.interval(accidental);
  var coord = coords(noteName.toLowerCase());

  coord[0] += octave;
  coord[0] += accidentalValue[0] - coords.A4[0];
  coord[1] += accidentalValue[1] - coords.A4[1];

  return coord;
};

},{"accidental-value":25,"notecoord":26}],25:[function(require,module,exports){
arguments[4][21][0].apply(exports,arguments)
},{"dup":21}],26:[function(require,module,exports){
arguments[4][22][0].apply(exports,arguments)
},{"dup":22}]},{},[1]);
