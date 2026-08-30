const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const postersDir = path.resolve(__dirname, '../storage/posters');
if (!fs.existsSync(postersDir)) {
  fs.mkdirSync(postersDir, { recursive: true });
}

// Function to generate a simple uncompressed PNG with custom colors
function createSolidPng(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(2, 9); // Color type 2 (RGB)
  ihdrData.writeUInt8(0, 10); // Compression method 0
  ihdrData.writeUInt8(0, 11); // Filter method 0
  ihdrData.writeUInt8(0, 12); // Interlace method 0
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw image data: height rows, each starting with filter byte 0, followed by width * 3 bytes (RGB)
  const rawRow = Buffer.alloc(1 + width * 3);
  rawRow[0] = 0; // Filter None
  for (let x = 0; x < width; x++) {
    rawRow[1 + x * 3] = r;
    rawRow[1 + x * 3 + 1] = g;
    rawRow[1 + x * 3 + 2] = b;
  }

  const rawData = Buffer.concat(Array(height).fill(rawRow));
  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(12 + length);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + length));
  chunk.writeInt32BE(crc, 8 + length);
  return chunk;
}

// Simple CRC32 implementation
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return crc ^ -1;
}

const crcTable = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c;
}

// Generate 3 sample posters (1080x1080)
const posterA = createSolidPng(1080, 1080, 99, 102, 241); // Indigo
fs.writeFileSync(path.join(postersDir, 'poster_A_promo_diskon.png'), posterA);
console.log('✅ Created poster_A_promo_diskon.png (1080x1080 Indigo)');

const posterB = createSolidPng(1080, 1080, 16, 185, 129); // Emerald
fs.writeFileSync(path.join(postersDir, 'poster_B_info_loker.png'), posterB);
console.log('✅ Created poster_B_info_loker.png (1080x1080 Emerald)');

const posterC = createSolidPng(1080, 1080, 245, 158, 11); // Amber
fs.writeFileSync(path.join(postersDir, 'poster_C_event_seminar.png'), posterC);
console.log('✅ Created poster_C_event_seminar.png (1080x1080 Amber)');
