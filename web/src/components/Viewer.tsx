"use client"

import * as React from 'react'
import { ProjectPicker } from '@/components/ProjectPicker'
import { FileTree, type FileNode } from '@/components/FileTree'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

export default function Viewer() {
  const [projects, setProjects] = React.useState<string[]>([])
  const [selected, setSelected] = React.useState<string | undefined>(undefined)
  const [tree, setTree] = React.useState<FileNode | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    fetch('http://localhost:3001/api/projects')
      .then((r) => r.json())
      .then((data: string[]) => setProjects(data))
      .catch(() => setProjects([]))
  }, [])

  React.useEffect(() => {
    if (!selected) {
      setTree(null)
      return
    }
    setLoading(true)
    fetch(`http://localhost:3001/api/projects/${encodeURIComponent(selected)}/tree`)
      .then((r) => r.json())
      .then((data: FileNode) => setTree(data))
      .catch(() => setTree(null))
      .finally(() => setLoading(false))
  }, [selected])

  return (
    <div className="grid grid-cols-[280px_1fr] gap-4 min-h-screen p-4">
      {/* Sidebar */}
      <aside className="bg-muted/30 rounded-lg p-3 flex flex-col" data-name="sidebar">
        <ProjectPicker projects={projects} value={selected} onChange={setSelected} />
        <Separator className="my-3" />
        <div className="text-sm text-muted-foreground mb-2">Files</div>
        <ScrollArea className="h-[calc(100vh-200px)] pr-2">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading tree…</div>
          ) : (
            <FileTree root={tree} />
          )}
        </ScrollArea>
      </aside>

      {/* Main content */}
      <main className="bg-muted/30 rounded-lg p-4" data-name="document-body">
        <div className="text-sm text-muted-foreground">Document body</div>
      </main>
    </div>
  )
}

