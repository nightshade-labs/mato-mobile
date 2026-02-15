// polyfill.js
import { Buffer } from 'buffer';
import { install } from 'react-native-quick-crypto';

install();
// Keep Node-compatible Buffer semantics for Anchor/buffer-layout decode paths.
global.Buffer = Buffer;
global.TextEncoder = require('text-encoding').TextEncoder;
global.assert = require('assert');

Buffer.prototype.subarray = function subarray(begin, end) {
  const result = Uint8Array.prototype.subarray.apply(this, [begin, end]);
  Object.setPrototypeOf(result, Buffer.prototype);
  return result;
};
