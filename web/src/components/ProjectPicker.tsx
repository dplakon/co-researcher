import * as React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ProjectPickerProps {
  projects: string[]
  value: string | undefined
  onChange: (value: string) => void
}

export function ProjectPicker({ projects, value, onChange }: ProjectPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm text-muted-foreground">Project</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={projects.length ? 'Select a project' : 'No projects found'} />
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

