import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { streamChat, fetchRequestMessages, fetchResource } from '../../api'
import { Markdown } from '../Markdown'
import type { ILayerField } from '../../types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatEmptyStateProps {
  sendMessage: (text: string) => void
}

export interface ChatStreamHandle {
  redraft: () => void
}

export const ChatStreamControl = forwardRef<ChatStreamHandle, {
  field: ILayerField
  appSlug?: string
  requestId?: string | null
  domainId?: string
  emptyState?: React.ReactNode | ((props: ChatEmptyStateProps) => React.ReactNode)
}>(function ChatStreamControl({ field, appSlug, requestId, domainId, emptyState }, ref) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [supportRequestId, setSupportRequestId] = useState<string | undefined>(requestId || undefined)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const activeRequestRef = useRef<string | null | undefined>(requestId)
  messagesRef.current = messages

  const endpoint = field.link?.address || '/ai/chat'

  // Load message history when requestId changes
  useEffect(() => {
    activeRequestRef.current = requestId
    if (!requestId || !domainId) {
      setMessages([])
      setSupportRequestId(undefined)
      setStreaming(false)
      setStreamingContent('')
      return
    }
    setSupportRequestId(requestId)
    setLoadingHistory(true)
    setStreaming(false)
    setStreamingContent('')
    const currentRequestId = requestId
    fetchRequestMessages(domainId, requestId)
      .then(async msgs => {
        if (activeRequestRef.current !== currentRequestId) return
        const parsed = msgs
          .filter(m => m.role && m.content)
          .map(m => ({
            role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.content,
          }))
        // If no messages, show the request's reference as the initial user message
        if (parsed.length === 0) {
          const resource = await fetchResource(requestId)
          if (resource?.reference && activeRequestRef.current === currentRequestId) {
            parsed.push({ role: 'user', content: resource.reference })
          }
        }
        if (activeRequestRef.current === currentRequestId) {
          setMessages(parsed)
        }
      })
      .catch(() => {
        if (activeRequestRef.current !== currentRequestId) return
        setMessages([])
      })
      .finally(() => {
        if (activeRequestRef.current !== currentRequestId) return
        setLoadingHistory(false)
      })
  }, [requestId, domainId])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const doStream = useCallback((msgs: ChatMessage[]) => {
    setStreaming(true)
    setStreamingContent('')

    const allMessages = msgs.map(m => ({ role: m.role, content: m.content }))

    streamChat(
      endpoint,
      {
        messages: allMessages,
        ...(appSlug && { appSlug }),
        ...(supportRequestId && { supportRequestId }),
      },
      (chunk) => setStreamingContent(prev => prev + chunk),
      (result) => {
        setStreamingContent(prev => {
          if (prev) {
            setMessages(current => [...current, { role: 'assistant', content: prev }])
          }
          return ''
        })
        setStreaming(false)
        if (result?.supportRequestId) setSupportRequestId(result.supportRequestId)
      },
      (error) => {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }])
        setStreaming(false)
        setStreamingContent('')
      },
    )
  }, [endpoint, appSlug, supportRequestId])

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || streaming) return

    const userMsg: ChatMessage = { role: 'user', content: text.trim() }
    const updated = [...messagesRef.current, userMsg]
    setMessages(updated)
    setInput('')
    doStream(updated)
  }, [streaming, doStream])

  const redraft = useCallback(() => {
    if (streaming) return
    const msgs = [...messagesRef.current]
    // Remove trailing assistant messages
    while (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
      msgs.pop()
    }
    if (msgs.length === 0) return
    setMessages(msgs)
    doStream(msgs)
  }, [streaming, doStream])

  useImperativeHandle(ref, () => ({ redraft }), [redraft])

  const send = useCallback(() => sendMessage(input), [input, sendMessage])

  const hasRequest = !!requestId

  return (
    <div className="flex flex-col h-full min-h-[400px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loadingHistory && (
          <div className="text-center text-muted-foreground animate-pulse py-4">Loading messages...</div>
        )}
        {!loadingHistory && messages.length === 0 && !streaming && !hasRequest && (
          typeof emptyState === 'function' ? emptyState({ sendMessage }) : emptyState
        )}
        {!loadingHistory && messages.length === 0 && !streaming && hasRequest && (
          <div className="text-center text-muted-foreground py-8">No messages found for this request.</div>
        )}
        {messages.map((msg, i) => (
          <div key={`${msg.role}-${i}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
          disabled={streaming || loadingHistory}
          className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim() || loadingHistory}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary-700 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  )
})
