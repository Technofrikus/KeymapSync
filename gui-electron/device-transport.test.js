const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createDeviceTransport, parseVitalyDevices } = require('./device-transport');

async function runTests() {
  const devices = parseVitalyDevices(`Product name: "Board" id: 123,
Manufacturer name: "Maker", id: 456,
Release: 1, Serial: "serial", Path: "/dev/hidraw0"
Capabilities:
layer_count: 4
combo_count: 2
tap_dance_count: 0`);
  assert.deepStrictEqual(devices, [{
    capabilities: { layer_count: 4, combo_count: 2, tap_dance_count: 0 },
    product_name: 'Board', product_id: 123, id: 123,
    manufacturer_name: 'Maker', vendor_id: 456,
    release: 1, serial_number: 'serial', path: '/dev/hidraw0',
    layers: 4, has_combos: true, has_tap_dance: false,
  }]);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keymapsync-device-test-'));
  const commands = [];
  let appliedState;
  let appliedRaw;
  const transport = createDeviceTransport({
    tempDir,
    runCommand: async (args) => {
      commands.push(args);
      if (args[0] === 'devices') return { stdout: 'Product name: "Board" id: 123,' };
      if (args.includes('save')) {
        fs.writeFileSync(args.at(-1), '{"uid": 12345678901234567890, "layout": []}');
        return { stdout: '' };
      }
      if (args.includes('load')) {
        appliedRaw = fs.readFileSync(args.at(-1), 'utf8');
        appliedState = JSON.parse(appliedRaw);
        return { stdout: 'loaded' };
      }
      if (args.includes('layout')) return { stdout: 'LAYOUT_ortho_4x12' };
      return { stdout: '' };
    },
  });

  assert.strictEqual((await transport.discover())[0].id, 123);
  const snapshot = await transport.snapshot(123);
  assert.deepStrictEqual(snapshot, { uid: '12345678901234567890', layout: [] });
  await transport.apply(123, { uid: snapshot.uid, layout: [['KC_A']] });
  assert.deepStrictEqual(appliedState, { uid: 12345678901234567000, layout: [['KC_A']] });
  assert.match(appliedRaw, /"uid": 12345678901234567890/);
  assert.strictEqual(await transport.layout(123), 'LAYOUT_ortho_4x12');
  await transport.lock(123, true);
  assert.deepStrictEqual(commands.at(-1), ['-i', '123', 'lock', '-l']);
  assert.deepStrictEqual(fs.readdirSync(tempDir), []);

  const noDevices = createDeviceTransport({
    tempDir,
    runCommand: async () => { throw new Error('No matching devices found'); },
  });
  assert.deepStrictEqual(await noDevices.discover(), []);
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('Device transport tests passed.');
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

module.exports = { runTests };
