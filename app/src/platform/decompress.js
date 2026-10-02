/* Browser decompressors for the Vial keyboard definition. Vial firmware ships
 * the definition xz-compressed; xz-decompress (MIT, WebAssembly) reads it. */
import xzDecompress from 'xz-decompress';

async function decompressXz(data) {
  const input = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(data));
      controller.close();
    },
  });
  const output = await new Response(new xzDecompress.XzReadableStream(input)).arrayBuffer();
  return new TextDecoder().decode(output);
}

// Raw LZMA ("lzma-alone") definitions come from very old Vial builds only.
async function decompressLzma() {
  throw new Error('This keyboard stores its layout in an old format the web version cannot read. Use the desktop app.');
}

export { decompressXz, decompressLzma };
