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
