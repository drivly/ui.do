import { useState, useRef, useEffect, useCallback } from 'react'
import { streamChat } from '../../api'
import { Markdown } from '../Markdown'
import type { ILayerField } from '../../types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatEmptyStateProps {
  sendMessage: (text: string) => void
}

export function ChatStreamControl({ field, appSlug, emptyState }: {
  field: ILayerField
  appSlug?: string
  emptyState?: React.ReactNode | ((props: ChatEmptyStateProps) => React.ReactNode)
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const endpoint = field.link?.address || '/ai/chat'

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || streaming) return

    const userMsg: ChatMessage = { role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)
    setStreamingContent('')

    const allMessages = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }))

    streamChat(
      endpoint,
      { messages: allMessages, ...(appSlug && { appSlug }) },
      (chunk) => setStreamingContent(prev => prev + chunk),
      () => {
        setStreamingContent(prev => {
          if (prev) {
            setMessages(msgs => [...msgs, { role: 'assistant', content: prev }])
          }
          return ''
        })
        setStreaming(false)
      },
      (error) => {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }])
        setStreaming(false)
        setStreamingContent('')
      },
    )
  }, [streaming, messages, endpoint])

  const send = useCallback(() => sendMessage(input), [input, sendMessage])

  return (
    <div className="flex flex-col h-full min-h-[400px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !streaming && (
          typeof emptyState === 'function' ? emptyState({ sendMessage }) : emptyState
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
              msg.role === 'user'
                ? 'bg-primary-600 text-white rounded-br-md'
                : 'bg-card border border-border rounded-bl-md'
            }`}>
              {msg.role === 'user' ? msg.content : <Markdown>{msg.content}</Markdown>}
            </div>
          </div>
        ))}
        {streaming && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-card border border-border rounded-bl-md">
              <Markdown>{streamingContent}</Markdown>
            </div>
          </div>
        )}
        {streaming && !streamingContent && (
          <div className="flex justify-start">
            <div className="px-4 py-2 text-muted-foreground animate-pulse">Thinking...</div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={field.placeholder || 'Type a message...'}
          disabled={streaming}
          className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary-700 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  )
}
