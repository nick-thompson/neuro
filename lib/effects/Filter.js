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
