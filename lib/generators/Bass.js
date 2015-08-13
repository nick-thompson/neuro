var teoria = require('teoria');

/**
 * A simple detuned saw pair with a sub sine for those lows.
 *
 * @param {AudioContext} ctx
 */

function Bass(ctx) {
  this.ctx = ctx;
  this.detuneRatio = 2.0590 / 2;
  this.output = this.ctx.createGain();

  this.sawOne = null;
  this.sawTwo = null;
  this.sub = null;
}

Bass.prototype._setInternalNodes = function() {
  this.sawOne = this.ctx.createOscillator();
  this.sawTwo = this.ctx.createOscillator();
  this.sub = this.ctx.createOscillator();

  this.sawOne.type = 'sawtooth';
  this.sawTwo.type = 'sawtooth';

  this.sawOne.connect(this.output);
  this.sawTwo.connect(this.output);
  this.sub.connect(this.output);
};

Bass.prototype.connect = function(dest) {
  this.output.connect(dest.input ? dest.input : dest);
};

Bass.prototype.disconnect = function(dest) {
  if (!dest) {
    return this.output.disconnect();
  }
  this.output.disconnect(dest.input ? dest.input : dest);
}

Bass.prototype.start = function(when, offset, duration) {
  this.sawOne.start(when, offset, duration);
  this.sawTwo.start(when, offset, duration);
  this.sub.start(when, offset, duration);
};

Bass.prototype.stop = function(when) {
  this.sawOne.stop(when);
  this.sawTwo.stop(when);
  this.sub.stop(when);
};

Bass.prototype.play = function(bpm, bars, notes, callback) {
  var beats = 4 * bars;
  var duration = (60 / bpm) * beats;
  var interval = duration / notes.length;

  this._setInternalNodes();
  this.sawOne.onended = callback;

  // I'm assuming that the first note here is not a rest.
  var fq = teoria.note(notes[0]).fq();
  this.sub.frequency.setValueAtTime(fq, this.ctx.currentTime);
  this.sawOne.frequency.setValueAtTime(fq, this.ctx.currentTime);
  this.sawTwo.frequency.setValueAtTime(
    fq * this.detuneRatio,
    this.ctx.currentTime
  );
  
  notes.slice(1).forEach(function(note, i) {
    if (note === '__') {
      return;
    }
    var fq = teoria.note(note).fq();
    var delta = i * interval;
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
};

module.exports = Bass;
