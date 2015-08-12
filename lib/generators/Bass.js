var teoria = require('teoria');

/**
 * A simple detuned saw synthesizer with a sub sine for those lows.
 *
 * @param {AudioContext} ctx
 */

function Bass(ctx) {
  this.ctx = ctx;
  this.sawOne = ctx.createOscillator();
  this.sawTwo = ctx.createOscillator();
  this.sub = ctx.createOscillator();
  this.detuneRatio = 2.0590 / 2;
  this.duration = 0;

  this.sawOne.type = 'sawtooth';
  this.sawTwo.type = 'sawtooth';
}

Bass.prototype.connect = function(dest) {
  var d = dest.input ? dest.input : dest;
  this.sawOne.connect(d);
  this.sawTwo.connect(d);
  this.sub.connect(d);
};

Bass.prototype.start = function(t) {
  t = t || 0;
  this.sawOne.start(t);
  this.sawTwo.start(t);
  this.sub.start(t);
};

Bass.prototype.stop = function(t) {
  t = t || 0;
  this.sawOne.stop(t);
  this.sawTwo.stop(t);
  this.sub.stop(t);
};

Bass.prototype.play = function() {
  if (this.duration > 0) {
    this.start();
    this.stop(this.ctx.currentTime + this.duration);
  }
};

Bass.prototype.schedule = function(bpm, bars, notes) {
  var beats = 4 * bars;
  var time = (60 / bpm) * beats;
  var interval = time / notes.length;

  this.duration = time;

  // This scheduling algorithm assumes that the first note is not a rest, and
  // schedules gradual transitions between each note.
  var firstNote = notes[0];
  var fq = teoria.note(firstNote).fq();
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

    this.sawOne.frequency.exponentialRampToValueAtTime(fq, t);
    this.sawTwo.frequency.exponentialRampToValueAtTime(fq * this.detuneRatio, t);
    this.sub.frequency.exponentialRampToValueAtTime(fq, t);
  }, this);
};

module.exports = Bass;
