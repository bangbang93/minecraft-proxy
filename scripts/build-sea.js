const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { build } = require('esbuild')

const TARGETS = {
  'linux-x64': { platform: 'linux', arch: 'x64', output: 'mcproxy-linux-x64' },
  'linux-arm64': { platform: 'linux', arch: 'arm64', output: 'mcproxy-linux-arm64' },
  'darwin-x64': { platform: 'darwin', arch: 'x64', output: 'mcproxy-darwin-x64' },
  'darwin-arm64': { platform: 'darwin', arch: 'arm64', output: 'mcproxy-darwin-arm64' },
  'win32-x64': { platform: 'win32', arch: 'x64', output: 'mcproxy-win-x64.exe' },
}

const currentPlatform = os.platform()
const currentArch = os.arch()
const targetKey = `${currentPlatform}-${currentArch}`

const target = TARGETS[targetKey]
if (!target) {
  console.error(`No target for ${targetKey}`)
  console.error('Available targets:', Object.keys(TARGETS).join(', '))
  process.exit(1)
}

const projectRoot = path.resolve(__dirname, '..')
const seaDir = path.join(projectRoot, 'sea')

console.log(`Building SEA for ${targetKey}...`)

async function buildSea() {
  console.log('Compiling TypeScript...')
  execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' })

  if (!fs.existsSync(seaDir)) {
    fs.mkdirSync(seaDir, { recursive: true })
  }

  const bundlePath = path.join(projectRoot, 'dist', 'sea-bundle.cjs')

  console.log('Bundling with esbuild...')
  await build({
    entryPoints: [path.join(projectRoot, 'src', 'sea-entry.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: bundlePath,
    external: ['dtrace-provider'],
    minify: false,
    sourcemap: true,
    target: 'node25',
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  })

  const config = {
    main: bundlePath,
    output: path.join(seaDir, target.output),
    disableExperimentalSEAWarning: true,
    useCodeCache: false,
    useSnapshot: false,
    assets: {}
  }

  const configPath = path.join(seaDir, 'sea-config.json')
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

  console.log('Building SEA with --build-sea...')
  try {
    execSync(`node --build-sea ${configPath}`, { cwd: projectRoot, stdio: 'inherit' })
    console.log(`SEA build complete: ${config.output}`)
  } catch (err) {
    console.error('SEA build failed. Ensure you are using Node.js 25.5+')
    console.error('Error:', err.message)
    process.exit(1)
  }
}

buildSea().catch((err) => {
  console.error('Build failed:', err)
  process.exit(1)
})
