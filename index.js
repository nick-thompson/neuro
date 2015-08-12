var Bass = require('./lib/generators/Bass');

var ctx = new AudioContext();
var bass = new Bass(ctx);

var BPM = 130;

bass.connect(ctx.destination);
bass.schedule(BPM, 1, ['f1', '__', 'f1', 'f3',
                       'f1', 'f1', 'f3', 'f1',
                       'f1', '__', '__', '__',
                       '__', '__', '__', 'a2']);
bass.start();

setTimeout(function() {
  bass.stop();
}, 2000);
