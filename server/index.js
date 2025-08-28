const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: ['http://localhost:3000'],
}))
app.use(express.json())

app.get('/api/hello', (_req, res) => {
  res.json({ message: 'Hello from Node backend!' })
})

// Base directory for projects
const PROJECTS_DIR = path.join(__dirname, 'projects')

// Utility: safely resolve a project path under PROJECTS_DIR
function resolveProjectRoot(projectName) {
  const resolved = path.join(PROJECTS_DIR, projectName)
  const relative = path.relative(PROJECTS_DIR, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null
  }
  return resolved
}

// GET /api/projects -> ["projA", "projB", ...]
app.get('/api/projects', async (_req, res) => {
  try {
    await fs.promises.mkdir(PROJECTS_DIR, { recursive: true })
    const entries = await fs.promises.readdir(PROJECTS_DIR, { withFileTypes: true })
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort()
    res.json(dirs)
  } catch (err) {
    console.error('Error listing projects', err)
    res.status(500).json({ error: 'Failed to list projects' })
  }
})

// Build file tree recursively
async function buildTree(dir, base) {
  const result = []
  const entries = await fs.promises.readdir(dir, { withFileTypes: true })
  // Sort: directories first then files, alphabetical
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1
    if (!a.isDirectory() && b.isDirectory()) return 1
    return a.name.localeCompare(b.name)
  })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relPath = base ? path.join(base, entry.name) : entry.name
    if (entry.isDirectory()) {
      const children = await buildTree(fullPath, relPath)
      result.push({ name: entry.name, type: 'dir', path: relPath, children })
    } else if (entry.isFile()) {
      result.push({ name: entry.name, type: 'file', path: relPath })
    }
    // ignore symlinks and others for now
  }
  return result
}

// GET /api/projects/:project/tree -> nested file tree
app.get('/api/projects/:project/tree', async (req, res) => {
  try {
    const { project } = req.params
    const root = resolveProjectRoot(project)
    if (!root) return res.status(400).json({ error: 'Invalid project' })
    const exists = fs.existsSync(root)
    if (!exists) return res.status(404).json({ error: 'Project not found' })

    const tree = await buildTree(root, '')
    res.json({ name: project, type: 'dir', path: '', children: tree })
  } catch (err) {
    console.error('Error building file tree', err)
    res.status(500).json({ error: 'Failed to build file tree' })
  }
})

// GET /api/projects/:project/file?path=relative/path -> file content (text)
app.get('/api/projects/:project/file', async (req, res) => {
  try {
    const { project } = req.params
    const relPath = req.query.path
    if (typeof relPath !== 'string' || !relPath) {
      return res.status(400).json({ error: 'Missing or invalid path' })
    }
    const root = resolveProjectRoot(project)
    if (!root) return res.status(400).json({ error: 'Invalid project' })

    const fullPath = path.join(root, relPath)
    const safeRel = path.relative(root, fullPath)
    if (safeRel.startsWith('..') || path.isAbsolute(safeRel)) {
      return res.status(400).json({ error: 'Invalid path' })
    }
    const stat = await fs.promises.stat(fullPath).catch(() => null)
    if (!stat || !stat.isFile()) {
      return res.status(404).json({ error: 'File not found' })
    }
    // Read as UTF-8 text, with a soft size guard (2MB)
    if (stat.size > 2 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large to preview' })
    }
    const content = await fs.promises.readFile(fullPath, 'utf8')
    res.json({ path: relPath, content })
  } catch (err) {
    console.error('Error reading file', err)
    res.status(500).json({ error: 'Failed to read file' })
  }
})

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
  console.log(`Projects directory: ${PROJECTS_DIR}`)
})
