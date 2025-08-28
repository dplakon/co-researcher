import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Brain, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Thought {
  id: number
  type: 'analysis' | 'suggestion' | 'question'
  content: string
  timestamp: string
}

interface ThoughtStreamProps {
  project?: string
  filePath?: string
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

export function ThoughtStream({ project, filePath }: ThoughtStreamProps) {
  const [thoughts, setThoughts] = React.useState<Thought[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isStreaming, setIsStreaming] = React.useState(false)
  const eventSourceRef = React.useRef<EventSource | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    // Cleanup previous stream
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    if (!project || !filePath) {
      setThoughts([])
      setIsStreaming(false)
      return
    }

    setLoading(true)
    setError(null)
    setThoughts([])
    setIsStreaming(true)
    
    // Create SSE connection
    const url = `http://localhost:3001/api/projects/${encodeURIComponent(project)}/thoughts/stream?path=${encodeURIComponent(filePath)}`
    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.thought) {
          setThoughts(prev => [...prev, data.thought])
          setLoading(false)
          
          // Auto-scroll to bottom when new thought arrives
          setTimeout(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            }
          }, 100)
        }
        
        if (data.done) {
          setIsStreaming(false)
          eventSource.close()
        }
        
        if (data.error) {
          setError(data.error)
          setIsStreaming(false)
          eventSource.close()
        }
      } catch (e) {
        console.error('Failed to parse SSE data:', e)
      }
    }
    
    eventSource.onerror = (err) => {
      console.error('SSE error:', err)
      setError('Connection to thought stream lost')
      setLoading(false)
      setIsStreaming(false)
      eventSource.close()
    }
    
    // Cleanup on unmount or when deps change
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [project, filePath])

  const getThoughtIcon = (type: Thought['type']) => {
    switch (type) {
      case 'analysis':
        return <Brain className="h-3 w-3" />
      case 'suggestion':
        return <Sparkles className="h-3 w-3" />
      case 'question':
        return <span className="text-xs font-bold">?</span>
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Brain className="h-4 w-4" />
          Thought Stream
          {isStreaming && (
            <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Streaming...
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Loader2 className="h-8 w-8 mb-2 animate-spin" />
            <p className="text-xs">Generating thoughts...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Brain className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-xs text-red-600">{error}</p>
          </div>
        ) : !project || !filePath ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Brain className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-xs">Select a file to generate thoughts</p>
          </div>
        ) : thoughts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Brain className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-xs">No thoughts generated</p>
          </div>
        ) : (
          <div className="space-y-2">
            {thoughts.map(thought => (
              <div 
                key={thought.id} 
                className={cn(
                  "p-2 rounded-md border-l-2",
                  thought.type === 'analysis' && "bg-blue-50 dark:bg-blue-950/20 border-blue-500",
                  thought.type === 'suggestion' && "bg-green-50 dark:bg-green-950/20 border-green-500",
                  thought.type === 'question' && "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-500"
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{getThoughtIcon(thought.type)}</div>
                  <div className="flex-1">
                    <p className="text-xs leading-relaxed">{thought.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatTimestamp(thought.timestamp)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
