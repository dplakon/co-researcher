const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const util = require('util')

const execPromise = util.promisify(exec)

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

// GET /api/projects/:project/thoughts/stream?path=relative/path -> SSE stream of thoughts
app.get('/api/projects/:project/thoughts/stream', async (req, res) => {
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

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': 'http://localhost:3000'
    })

    let thoughtHistory = []
    let thoughtId = 1
    let iteration = 0
    const MAX_ITERATIONS = 10 // Prevent infinite loops
    
    // Function to generate thoughts
    async function generateThoughts() {
      if (iteration >= MAX_ITERATIONS) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
        return
      }
      
      iteration++
      
      let prompt
      if (thoughtHistory.length === 0) {
        // Initial prompt
        prompt = `Read the document at ${fullPath} and generate exactly 3 thoughts about it: one analysis, one suggestion, and one question. Return as a JSON array with objects having "type" and "content" fields. Example: [{"type": "analysis", "content": "..."}, {"type": "suggestion", "content": "..."}, {"type": "question", "content": "..."}]`
      } else {
        // Recursive prompt with history
        const recentThoughts = thoughtHistory.slice(-3).map(t => `${t.type}: ${t.content}`).join('\n')
        prompt = `Given these previous thoughts about the document at ${fullPath}:\n${recentThoughts}\n\nBuild on these insights to generate 3 NEW deeper thoughts (one of each type: analysis, suggestion, question). Go deeper, explore different angles, or follow up on the previous thoughts. Return as a JSON array with "type" and "content" fields.`
      }
      
      console.log(`Thought stream iteration ${iteration} for:`, relPath)
      const command = `warp-preview agent run --prompt "${prompt.replace(/"/g, '\\"')}"`
      
      try {
        const { stdout, stderr } = await execPromise(command, {
          maxBuffer: 1024 * 1024 * 10
        })
        
        if (stderr) {
          console.warn('Warp SDK stderr:', stderr)
        }

        let thoughts = []
        try {
          const jsonMatch = stdout.match(/\[.*\]/s)
          if (jsonMatch) {
            thoughts = JSON.parse(jsonMatch[0])
          } else {
            thoughts = [{
              type: 'analysis',
              content: stdout.trim() || 'Continuing analysis...'
            }]
          }
        } catch (parseErr) {
          console.error('Failed to parse Warp SDK response:', parseErr)
          thoughts = [{
            type: 'analysis',
            content: stdout.trim() || 'Continuing analysis...'
          }]
        }
        
        // Send each thought as an SSE event
        for (const thought of thoughts) {
          const thoughtWithMeta = {
            ...thought,
            id: thoughtId++,
            timestamp: new Date().toISOString(),
            iteration
          }
          
          thoughtHistory.push(thought)
          res.write(`data: ${JSON.stringify({ thought: thoughtWithMeta })}\n\n`)
          
          // Small delay between thoughts for visual effect
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        
        // Wait before next iteration
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Recursively generate more thoughts
        await generateThoughts()
        
      } catch (cmdErr) {
        console.error('Error in thought generation iteration:', cmdErr)
        res.write(`data: ${JSON.stringify({ error: 'Generation stopped', done: true })}\n\n`)
        res.end()
      }
    }
    
    // Start the thought generation loop
    generateThoughts().catch(err => {
      console.error('Thought stream error:', err)
      res.write(`data: ${JSON.stringify({ error: err.message, done: true })}\n\n`)
      res.end()
    })
    
    // Handle client disconnect
    req.on('close', () => {
      console.log('Client disconnected from thought stream')
      res.end()
    })
    
  } catch (err) {
    console.error('Error starting thought stream:', err)
    res.status(500).json({ error: 'Failed to start thought stream' })
  }
})

// GET /api/projects/:project/notes?path=relative/path -> LLM note cards about file
app.get('/api/projects/:project/notes', async (req, res) => {
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

    // Construct the prompt for Warp SDK to generate note cards
    const prompt = `Read the document at ${fullPath} and generate important note cards about it. Each note should capture a key insight, important detail, or actionable item. Return your response as a JSON array where each element is an object with these fields: "title" (a short title for the note), "content" (the detailed note content). Generate 3-5 note cards. Example format: [{"title": "Key Architecture Decision", "content": "The system uses microservices..."}, {"title": "Performance Consideration", "content": "Caching is implemented at..."}]`
    
    // Call Warp SDK
    console.log('Calling Warp SDK for note cards on:', relPath)
    const command = `warp-preview agent run --prompt "${prompt.replace(/"/g, '\\"')}"`
    
    try {
      const { stdout, stderr } = await execPromise(command, {
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer for large responses
      })
      
      if (stderr) {
        console.warn('Warp SDK stderr:', stderr)
      }

      // Try to parse the response as JSON
      let notes = []
      try {
        // The response might have extra text, try to extract JSON array
        const jsonMatch = stdout.match(/\[.*\]/s)
        if (jsonMatch) {
          notes = JSON.parse(jsonMatch[0])
        } else {
          // Fallback: create a single note from the response
          notes = [{
            title: 'Document Note',
            content: stdout.trim() || 'No notes generated'
          }]
        }
      } catch (parseErr) {
        console.error('Failed to parse Warp SDK response as JSON:', parseErr)
        // Return the raw text as a single note
        notes = [{
          title: 'Document Note',
          content: stdout.trim() || 'No notes generated'
        }]
      }
      
      // Add IDs to notes
      const notesWithIds = notes.map((note, idx) => ({
        ...note,
        id: idx + 1
      }))
      
      res.json({ notes: notesWithIds })
    } catch (cmdErr) {
      console.error('Error executing Warp SDK command for notes:', cmdErr)
      // Return fallback notes if Warp SDK fails
      res.json({ 
        notes: [
          {
            id: 1,
            title: 'Unable to Generate Notes',
            content: 'AI note generation is currently unavailable. Warp SDK might not be accessible.'
          }
        ]
      })
    }
  } catch (err) {
    console.error('Error getting notes:', err)
    res.status(500).json({ error: 'Failed to get notes' })
  }
})

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
  console.log(`Projects directory: ${PROJECTS_DIR}`)
})
