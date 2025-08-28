import * as React from 'react'
import { ChevronDown, ChevronRight, FileText, Folder } from 'lucide-react'
import { cn } from '@/lib/utils'

export type FileNode = {
  name: string
  type: 'file' | 'dir'
  path: string // path relative to project root
  children?: FileNode[]
}

interface FileTreeProps {
  root: FileNode | null
  onSelectFile?: (path: string) => void
  selectedPath?: string | null
}

function TreeItem({ node, level = 0, onSelectFile, selectedPath }: { node: FileNode; level?: number; onSelectFile?: (path: string) => void; selectedPath?: string | null }) {
  const [open, setOpen] = React.useState<boolean>(true)
  const isDir = node.type === 'dir'
  const isSelected = selectedPath === node.path && node.type === 'file'

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-1 px-2 rounded cursor-pointer',
          isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
        )}
        style={{ paddingLeft: 8 + level * 12 }}
        onClick={() => {
          if (isDir) setOpen((o) => !o)
          else onSelectFile?.(node.path)
        }}
      >
        {isDir ? (
          open ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />
        ) : (
          <span className="w-4" />
        )}
        {isDir ? (
          <Folder className="size-4 text-primary" />
        ) : (
          <FileText className="size-4 text-muted-foreground" />
        )}
        <span className="text-sm">{node.name}</span>
      </div>
      {isDir && open && node.children && (
        <div>
          {node.children.map((child, idx) => (
            <TreeItem key={`${node.path}/${child.name}#${idx}`} node={child} level={level + 1} onSelectFile={onSelectFile} selectedPath={selectedPath} />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileTree({ root, onSelectFile, selectedPath }: FileTreeProps) {
  if (!root) {
    return <div className="text-sm text-muted-foreground">No project selected</div>
  }
  return (
    <div className="text-sm">
      <TreeItem node={root} onSelectFile={onSelectFile} selectedPath={selectedPath ?? null} />
    </div>
  )
}

