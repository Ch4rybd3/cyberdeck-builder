/**
 * Regenerates the documentation screenshots in docs/images.
 *
 *   npm run dev                     # in one terminal
 *   npm run screenshots             # in another
 *
 * Needs a Chromium-based browser: set CHROME_PATH if it is not /usr/bin/chromium.
 * Uses the development hook window.__cdb (src/main.tsx), so it only works
 * against the dev server.
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const BASE = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'images')
mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 950, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', e => errors.push(e.message))

const sleep = ms => new Promise(r => setTimeout(r, ms))

/** Open a build on a route, with a theme, and wait for its geometry. */
async function open(route, buildId, theme = 'dark') {
  await page.goto(`${BASE}/#/library`, { waitUntil: 'networkidle0' })
  await page.evaluate((id, t) => {
    localStorage.setItem('cdb.currentBuild', id)
    localStorage.setItem('cdb.theme', t)
  }, buildId, theme)
  await page.goto(`${BASE}/#/${route}`, { waitUntil: 'networkidle0' })
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() => window.__cdb?.build.getState().ready)
  await waitGeometry()
}

async function waitGeometry() {
  await page.waitForFunction(() => {
    const g = window.__cdb.geometry.getState()
    const b = window.__cdb.build.getState().build
    return !g.busy && g.forBuild === `${b.id}@${b.updatedAt}`
  }, { timeout: 20000 })
  await sleep(700)
}

const view = patch => page.evaluate(p => window.__cdb.view.getState().set(p), patch)
const select = sel => page.evaluate(s => window.__cdb.build.getState().select(s), sel)
const accessoryId = kind => page.evaluate(k => window.__cdb.build.getState().build.accessories.find(a => a.kind === k)?.id, kind)
const clickText = text => page.evaluate(t => [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(t))?.click(), text)

async function shot(name, clip) {
  await sleep(400)
  const opts = { path: join(OUT, `${name}.png`) }
  if (clip === 'viewport') {
    const box = await (await page.$('canvas')).boundingBox()
    opts.clip = box
  } else if (clip === 'right') {
    const box = await (await page.$$('aside')).at(-1).boundingBox()
    opts.clip = { ...box, height: Math.min(box.height, 820) }
  } else if (clip === 'left') {
    const box = await (await page.$$('aside')).at(0).boundingBox()
    opts.clip = { ...box, height: Math.min(box.height, 700) }
  } else if (clip) opts.clip = clip
  await page.screenshot(opts)
  console.log('✓', name)
}

// ── Overview ──
await open('', 'example-wayfarer')
await shot('workshop')
await open('', 'example-wayfarer', 'light')
await shot('workshop-light')
await open('library', 'example-wayfarer')
await shot('library')

// ── Formats ──
await open('', 'example-vanguard')
await view({ lid: 'solid', slide: 0 })
await shot('format-tactical', 'viewport')
await view({ slide: 1 })
await shot('format-tactical-open', 'viewport')
await open('', 'example-courier')
await view({ lid: 'solid', lidOpen: 105 })
await shot('format-briefcase', 'viewport')
await page.evaluate(async () => {
  const b = window.__cdb.build.getState().create('suitcase')
  localStorage.setItem('cdb.currentBuild', b.id)
})
await sleep(900)
await page.reload({ waitUntil: 'networkidle0' })
await page.waitForFunction(() => window.__cdb?.build.getState().ready)
await waitGeometry()
await view({ lid: 'solid', lidOpen: 100 })
await shot('format-suitcase', 'viewport')
await page.evaluate(() => window.__cdb.build.getState().remove(window.__cdb.build.getState().build.id))

// ── Case shape ──
await open('', 'example-vanguard')
await select({ kind: 'case' })
await page.evaluate(() => [...document.querySelectorAll('aside')].at(-1).scrollTo(0, 420))
await shot('case-shape', 'right')

// ── Picatinny: add from the outline, then edit ──
await open('', 'example-vanguard')
await clickText('Outline')
await sleep(200)
await page.evaluate(() => [...document.querySelectorAll('button[title="Add an accessory"]')][0]?.click())
await shot('accessory-menu', 'left')
await select({ kind: 'accessory', id: await accessoryId('picatinny') })
await view({ explode: 0.6, slide: 0 })
await shot('picatinny')

// ── Slider ──
await open('', 'example-vanguard')
await select({ kind: 'accessory', id: await accessoryId('slider') })
await view({ explode: 0, slide: 0.5, lid: 'solid' })
await shot('slider')
await view({ explode: 0.8, slide: 0 })
await shot('slider-exploded', 'viewport')

// ── Move and rotate tools ──
await open('', 'example-wayfarer')
await page.evaluate(() => {
  const s = window.__cdb.build.getState()
  s.select({ kind: 'placement', id: s.build.placements.find(p => p.label === 'Pi 5').id })
})
await view({ lid: 'hidden', tool: 'move' })
await shot('tool-move', 'viewport')
await view({ tool: 'rotate' })
await shot('tool-rotate', 'viewport')
await view({ tool: 'select', lid: 'ghost' })

// ── Modules and text ──
await open('', 'example-wayfarer')
await select({ kind: 'accessory', id: await accessoryId('deckport') })
await view({ lid: 'solid', camera: 'iso' })
await shot('module-attached')
await view({ explode: 0.7 })
await shot('module-exploded', 'viewport')
await view({ explode: 0 })
await open('', 'example-vanguard')
await view({ lid: 'solid', camera: 'iso' })
await select({ kind: 'accessory', id: await accessoryId('picatinny') })
await shot('rail-module')
await shot('modules-panel', { x: 0, y: 70, width: 208, height: 240 })
await view({ lid: 'solid', camera: 'front', cameraRev: Date.now() })
await shot('text-label', 'viewport')
await view({ camera: 'iso' })

// ── Custom component editor ──
await open('', 'example-wayfarer')
await page.evaluate(() => document.querySelector('button[title="New custom component"]')?.click())
await sleep(300)
await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]')
  if (d) d.parentElement.style.alignItems = 'flex-start'
})
await shot('component-editor')
await page.keyboard.press('Escape')

// ── Tube handle close-ups ──
await open('library', 'example-wayfarer')
const demoId = await page.evaluate(() => {
  const s = window.__cdb.build.getState()
  const b = s.create('slab')
  s.update(d => {
    d.name = 'Handle demo'
    d.case.params.width = 200
    d.case.params.depth = 120
    d.case.params.trayHeight = 40
    d.accessories = [{ id: 'h1', kind: 'handle', part: 'tray', face: 'front', u: 0, v: 0, length: 150, rotation: 0, style: 'tube', texture: 'knurled' }]
  })
  return b.id
})
await sleep(900)
for (const texture of ['knurled', 'ribbed']) {
  await open('', demoId)
  await page.evaluate(t => window.__cdb.build.getState().update(d => void (d.accessories[0].texture = t)), texture)
  await waitGeometry()
  await view({ lid: 'solid', camera: 'front', cameraRev: Date.now() })
  await sleep(600)
  const box = await (await page.$('canvas')).boundingBox()
  await shot(`handle-${texture}`, { x: box.x + 150, y: box.y + 250, width: 500, height: 320 })
}
await page.evaluate(id => window.__cdb.build.getState().remove(id), demoId)
await view({ camera: 'iso' })

// ── Cable management close-up ──
await open('library', 'example-wayfarer')
const cableId = await page.evaluate(() => {
  const s = window.__cdb.build.getState()
  const b = s.create('slab')
  s.update(d => {
    d.name = 'Cable demo'
    d.case.params.width = 180
    d.case.params.depth = 110
    d.case.params.trayHeight = 40
    d.accessories = [
      { id: 'g', kind: 'gland', part: 'tray', face: 'front', u: -45, v: 2, length: 20, rotation: 0, gland: 'PG9' },
      { id: 'r', kind: 'grommet', part: 'tray', face: 'front', u: 30, v: 2, length: 26, width: 9, rotation: 0 },
      { id: 't1', kind: 'tiepoint', part: 'tray', face: 'bottom', u: -30, v: 10, length: 10, rotation: 0 },
      { id: 't2', kind: 'tiepoint', part: 'tray', face: 'bottom', u: 20, v: 10, length: 10, rotation: 0 },
    ]
  })
  return b.id
})
await sleep(900)
await open('', cableId)
await view({ lid: 'hidden', explode: 0.5, camera: 'iso', cameraRev: Date.now() })
await shot('cables', 'viewport')
await view({ lid: 'ghost', explode: 0 })
await page.evaluate(id => window.__cdb.build.getState().remove(id), cableId)

// ── Other pages ──
await open('', 'example-wayfarer')
await clickText('Checks')
await shot('checks', 'right')
for (const [route, name, id] of [
  ['power', 'power', 'example-wayfarer'],
  ['wiring', 'wiring', 'example-wayfarer'],
  ['bom', 'shopping-list', 'example-courier'],
  ['print', 'print', 'example-vanguard'],
  ['identity', 'deckid', 'example-vanguard'],
  ['assembly', 'assembly', 'example-vanguard'],
]) {
  await open(route, id)
  await shot(name)
}

// ── Assembly simulation, focused on the tube handle ──
await open('assembly', 'example-vanguard')
await page.evaluate(() => [...document.querySelectorAll('li button')].find(x => x.textContent.startsWith('Tube handle'))?.click())
await sleep(1200)
await shot('assembly-simulation', 'viewport')

await browser.close()
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
