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
