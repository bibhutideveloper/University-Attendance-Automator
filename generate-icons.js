const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create PNG buffer from raw RGBA pixels
function createPNG(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);   // bit depth 8
  ihdr.writeUInt8(6, 9);   // color type 6: RGBA
  ihdr.writeUInt8(0, 10);  // compression method
  ihdr.writeUInt8(0, 11);  // filter method
  ihdr.writeUInt8(0, 12);  // interlace method

  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT chunk (raw scanlines with filter byte 0)
  const scanlineLength = width * 4 + 1;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const srcOffset = (y * width + x) * 4;
      const destOffset = rowOffset + 1 + x * 4;
      rawData[destOffset] = rgbaBuffer[srcOffset];         // R
      rawData[destOffset + 1] = rgbaBuffer[srcOffset + 1]; // G
      rawData[destOffset + 2] = rgbaBuffer[srcOffset + 2]; // B
      rawData[destOffset + 3] = rgbaBuffer[srcOffset + 3]; // A
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);

  const crc = Buffer.alloc(4);
  crc.writeInt32BE(calcCrc(body), 0);

  return Buffer.concat([len, body, crc]);
}

function calcCrc(buf) {
  let c;
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
    }
    crcTable[n] = c;
  }

  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1));
}

function generateIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const center = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Rounded rectangle test
      const dx = Math.max(Math.abs(x + 0.5 - center) - (center - radius), 0);
      const dy = Math.max(Math.abs(y + 0.5 - center) - (center - radius), 0);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > radius) {
        // Outside rounded rect
        buf[idx] = 0;
        buf[idx + 1] = 0;
        buf[idx + 2] = 0;
        buf[idx + 3] = 0;
        continue;
      }

      // Background gradient (Indigo / Purple #4f46e5 to #2563eb)
      const gradRatio = (x + y) / (size * 2);
      const r = Math.round(79 * (1 - gradRatio) + 37 * gradRatio);
      const g = Math.round(70 * (1 - gradRatio) + 99 * gradRatio);
      const b = Math.round(229 * (1 - gradRatio) + 235 * gradRatio);

      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = 255;

      // Draw stylized Attendance Checkmark
      // Normalized coordinates [0, 1]
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;

      // Checkmark segments: (0.28, 0.52) to (0.45, 0.70) and (0.45, 0.70) to (0.75, 0.32)
      const distToSegment1 = distToSegment(nx, ny, 0.28, 0.52, 0.44, 0.68);
      const distToSegment2 = distToSegment(nx, ny, 0.44, 0.68, 0.74, 0.32);
      const minDist = Math.min(distToSegment1, distToSegment2);
      const strokeWidth = 0.085;

      if (minDist <= strokeWidth) {
        // Smooth white checkmark
        const alpha = Math.min(1, Math.max(0, (strokeWidth - minDist) / 0.02 + 0.5));
        buf[idx] = Math.round(r * (1 - alpha) + 255 * alpha);
        buf[idx + 1] = Math.round(g * (1 - alpha) + 255 * alpha);
        buf[idx + 2] = Math.round(b * (1 - alpha) + 255 * alpha);
        buf[idx + 3] = 255;
      }
    }
  }

  return createPNG(size, size, buf);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

[16, 32, 48, 128].forEach(size => {
  const png = generateIcon(size);
  fs.writeFileSync(path.join(__dirname, 'icons', `icon${size}.png`), png);
  console.log(`Generated icon${size}.png (${size}x${size})`);
});
