import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronLeft, ChevronRight, Plus, StickyNote, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface Note {
  id: number
  title: string
  content: string
}

interface NoteCardsProps {
  project?: string
  filePath?: string
}

export function NoteCards({ project, filePath }: NoteCardsProps) {
  const [notes, setNotes] = React.useState<Note[]>([])
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!project || !filePath) {
      setNotes([])
      setCurrentIndex(0)
      return
    }

    setLoading(true)
    setError(null)
    setCurrentIndex(0)
    
    fetch(`http://localhost:3001/api/projects/${encodeURIComponent(project)}/notes?path=${encodeURIComponent(filePath)}`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to get notes')
        }
        return r.json()
      })
      .then((data: { notes: Note[] }) => {
        setNotes(data.notes || [])
      })
      .catch((e: Error) => {
        setError(e.message)
        setNotes([])
      })
      .finally(() => setLoading(false))
  }, [project, filePath])

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? notes.length - 1 : prev - 1))
  }

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === notes.length - 1 ? 0 : prev + 1))
  }

  const currentNote = notes[currentIndex]

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Note Cards</CardTitle>
          <div className="flex items-center gap-1">
            {notes.length > 0 && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={goToPrevious}
                  disabled={notes.length <= 1}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground px-1">
                  {currentIndex + 1} / {notes.length}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={goToNext}
                  disabled={notes.length <= 1}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 ml-2">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto pb-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Loader2 className="h-8 w-8 mb-2 animate-spin" />
            <p className="text-xs">Generating notes...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <StickyNote className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-xs text-red-600">{error}</p>
          </div>
        ) : !project || !filePath ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <StickyNote className="h-8 w-8 mb-2" />
            <p className="text-xs">Select a file to generate notes</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <StickyNote className="h-8 w-8 mb-2" />
            <p className="text-xs">No notes generated</p>
          </div>
        ) : (
          <div className="bg-accent/30 rounded-lg p-4 h-full flex flex-col">
            <h3 className="font-medium text-sm mb-2">{currentNote.title}</h3>
            <div className="flex-1 overflow-y-auto">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {currentNote.content}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
