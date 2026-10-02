import assert from 'node:assert';
import { readKeyboardDefinition, MSG_LEN } from '../src/core/vial-definition.js';

const definitionJson = JSON.stringify({ name: 'Test', layouts: { keymap: [['0,0']] } });
const blob = new TextEncoder().encode(`LZ${definitionJson}`);

function fakeKeyboard() {
  const sent = [];
  const sendReceive = async (message) => {
    assert.strictEqual(message.length, MSG_LEN);
    sent.push(message);
    const response = new Array(MSG_LEN).fill(0);
    if (message[0] === 0xfe && message[1] === 0x01) {
      response[0] = blob.length & 0xff;
      response[1] = (blob.length >> 8) & 0xff;
    } else if (message[0] === 0xfe && message[1] === 0x02) {
      const block = message[2] | (message[3] << 8);
      blob.slice(block * MSG_LEN, (block + 1) * MSG_LEN).forEach((byte, i) => { response[i] = byte; });
    } else if (message[0] === 0x02 && message[1] === 0x02) {
      response.splice(2, 4, 0, 0, 0, 5);
    }
    return response;
  };
  return { sent, sendReceive };
}

const keyboard = fakeKeyboard();
const result = await readKeyboardDefinition(keyboard.sendReceive, {
  xz: async () => assert.fail('blob is not xz'),
  lzma: async (data) => {
    assert.deepStrictEqual(Array.from(data), Array.from(blob));
    return new TextDecoder().decode(data).slice(2);
  },
});
assert.strictEqual(result.ok, true);
assert.deepStrictEqual(result.definition, JSON.parse(definitionJson));
assert.strictEqual(result.layoutOptionsPacked, 5);
assert.strictEqual(keyboard.sent.filter((m) => m[1] === 0x02 && m[0] === 0xfe).length, Math.ceil(blob.length / MSG_LEN));

const tooLarge = await readKeyboardDefinition(async () => [0, 0, 0, 0xff, ...new Array(MSG_LEN - 4).fill(0)], {});
assert.strictEqual(tooLarge.ok, false);

console.log('Vial definition tests passed.');
