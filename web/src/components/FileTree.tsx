import * as React from 'react'
import { ChevronDown, ChevronRight, FileText, Folder } from 'lucide-react'
import { cn } from '@/lib/utils'

export type FileNode = {
  name: string
  type: 'file' | 'dir'
  children?: FileNode[]
}

interface FileTreeProps {
  root: FileNode | null
}

function TreeItem({ node, level = 0 }: { node: FileNode; level?: number }) {
  const [open, setOpen] = React.useState<boolean>(true)
  const isDir = node.type === 'dir'

  return (
    <div>
      <div
        className={cn('flex items-center gap-2 py-1 px-2 rounded hover:bg-accent/50 cursor-pointer')}
        style={{ paddingLeft: 8 + level * 12 }}
        onClick={() => isDir && setOpen((o) => !o)}
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
          {node.children.map((child) => (
            <TreeItem key={`${node.name}/${child.name}`} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileTree({ root }: FileTreeProps) {
  if (!root) {
    return <div className="text-sm text-muted-foreground">No project selected</div>
  }
  return (
    <div className="text-sm">
      <TreeItem node={root} />
    </div>
  )
}

