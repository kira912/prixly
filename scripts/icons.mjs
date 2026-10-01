// Régénère les icônes PNG de la PWA à partir des SVG (nécessite ImageMagick)
import { execFileSync } from 'node:child_process'

const run = (src, size, out) => execFileSync('magick', ['-background', 'none', '-density', '384', `public/${src}`, '-resize', `${size}x${size}`, `public/${out}`])
run('icon.svg', 192, 'icon-192.png')
run('icon.svg', 512, 'icon-512.png')
run('icon-maskable.svg', 512, 'icon-maskable-512.png')
