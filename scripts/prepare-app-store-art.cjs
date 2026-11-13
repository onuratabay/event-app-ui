// Export existing brand artwork into Apple's creative-asset sizes, preserving safe areas.
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')
const { createRequire } = require('node:module')
const Jimp = createRequire(require.resolve('@expo/image-utils'))('jimp-compact')
const root = path.resolve(__dirname, '..')
const output = path.join(root, 'assets/store/app-store/creative')
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1
  return n >>> 0
})
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  let crc = 0xffffffff
  for (const b of body) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8)
  const header = Buffer.alloc(4), footer = Buffer.alloc(4)
  header.writeUInt32BE(data.length)
  footer.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([header, body, footer])
}
// Explicit RGB encoder: Apple's creative PNG files must have no alpha channel.
function rgbPng(img) {
  const { width, height, data } = img.bitmap
  const scan = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    let to = y * (width * 3 + 1) + 1
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4
      scan[to++] = data[from]
      scan[to++] = data[from + 1]
      scan[to++] = data[from + 2]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(scan, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}
const specs = [
  { name: 'ewent-header-3840x1646.png', w: 3840, h: 1646, safe: [1097, 493, 1646, 661], mark: 580 },
  { name: 'ewent-search-3840x2560.png', w: 3840, h: 2560, safe: [836, 765, 2168, 1030], mark: 850 },
  { name: 'ewent-search-1920x1280.png', w: 1920, h: 1280, safe: [418, 383, 1084, 515], mark: 425 },
  { name: 'ewent-universal-5244x2950.png', w: 5244, h: 2950, safe: [1921, 660, 1402, 962], mark: 850 },
]
;(async () => {
  fs.mkdirSync(output, { recursive: true })
  const bg = await Jimp.read(path.join(root, 'assets/store/app-store/source/atmosphere.png'))
  const logo = await Jimp.read(path.join(root, 'assets/brand/ewentapp-logo.png'))
  const manifest = []
  for (const spec of specs) {
    const img = bg.clone().cover(spec.w, spec.h, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE, Jimp.RESIZE_BICUBIC)
    const [sx, sy, sw, sh] = spec.safe
    const x = Math.round(sx + (sw - spec.mark) / 2), y = Math.round(sy + (sh - spec.mark) / 2)
    if (x < sx || y < sy || x + spec.mark > sx + sw || y + spec.mark > sy + sh) throw new Error('Logo exceeds safe area')
    const mark = logo.clone().contain(spec.mark, spec.mark, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE, Jimp.RESIZE_BICUBIC)
    img.composite(mark, x, y)
    const data = rgbPng(img)
    fs.writeFileSync(path.join(output, spec.name), data)
    manifest.push({ file: spec.name, width: spec.w, height: spec.h, pngColorType: 2, alphaChannel: false, bytes: data.length, safeArea: spec.safe, logoBounds: [x, y, spec.mark, spec.mark] })
  }
  const icon = new Jimp(1024, 1024, '#0e1430')
  icon.composite(logo.clone().contain(1024, 1024), 0, 0)
  const iconData = rgbPng(icon)
  fs.writeFileSync(path.join(output, 'ewent-icon-1024.png'), iconData)
  manifest.push({ file: 'ewent-icon-1024.png', width: 1024, height: 1024, pngColorType: 2, alphaChannel: false, bytes: iconData.length })
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(JSON.stringify(manifest, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
