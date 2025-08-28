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
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null)
  const [fileContent, setFileContent] = React.useState<string>('')
  const [fileLoading, setFileLoading] = React.useState(false)
  const [fileError, setFileError] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch('http://localhost:3001/api/projects')
      .then((r) => r.json())
      .then((data: string[]) => setProjects(data))
      .catch(() => setProjects([]))
  }, [])

  React.useEffect(() => {
    if (!selected) {
      setTree(null)
      setSelectedPath(null)
      setFileContent('')
      setFileError(null)
      return
    }
    setLoading(true)
    fetch(`http://localhost:3001/api/projects/${encodeURIComponent(selected)}/tree`)
      .then((r) => r.json())
      .then((data: FileNode) => setTree(data))
      .catch(() => setTree(null))
      .finally(() => setLoading(false))
  }, [selected])

  React.useEffect(() => {
    if (!selected || !selectedPath) return
    setFileLoading(true)
    setFileError(null)
    fetch(`http://localhost:3001/api/projects/${encodeURIComponent(selected)}/file?path=${encodeURIComponent(selectedPath)}`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to load file')
        }
        return r.json()
      })
      .then((data: { path: string; content: string }) => {
        setFileContent(data.content)
      })
      .catch((e: Error) => {
        setFileContent('')
        setFileError(e.message)
      })
      .finally(() => setFileLoading(false))
  }, [selected, selectedPath])

  return (
    <div className="grid grid-cols-[280px_1fr] gap-4 h-screen p-4 overflow-hidden">
      {/* Sidebar - sticky */}
      <aside className="bg-muted/30 rounded-lg p-3 flex flex-col h-full overflow-hidden" data-name="sidebar">
        <ProjectPicker projects={projects} value={selected} onChange={setSelected} />
        <Separator className="my-3" />
        <div className="text-sm text-muted-foreground mb-2">Files</div>
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading tree…</div>
          ) : (
            <FileTree root={tree} onSelectFile={setSelectedPath} selectedPath={selectedPath} />
          )}
        </ScrollArea>
      </aside>

      {/* Main content - scrollable */}
      <main className="bg-muted/30 rounded-lg p-4 text-foreground overflow-y-auto h-full" data-name="document-body">
        {!selected ? (
          <div className="text-sm text-muted-foreground">Select a project to view files.</div>
        ) : !selectedPath ? (
          <div className="text-sm text-muted-foreground">Select a file to preview.</div>
        ) : fileLoading ? (
          <div className="text-sm text-muted-foreground">Loading file…</div>
        ) : fileError ? (
          <div className="text-sm text-red-600">{fileError}</div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-xs text-muted-foreground sticky top-0 bg-muted/30 pb-2">{selected}/{selectedPath}</div>
            <pre className="text-sm whitespace-pre-wrap leading-6 font-mono">{fileContent}</pre>
          </div>
        )}
      </main>
    </div>
  )
}

