import { Markdown } from '../Markdown'
import type { ILayerField } from '../../types'

interface ChatMessage {
  role: 'user' | 'agent' | 'admin'
  content: string
  timestamp: string
  escalationReason?: string
}

const ROLE_STYLES: Record<string, string> = {
  user: 'bg-primary-600 text-white rounded-br-md',
  agent: 'bg-card text-card-foreground rounded-bl-md shadow-sm border border-border',
  admin: 'bg-primary-900 text-white rounded-bl-md',
}

export function ChatControl({ field }: { field: ILayerField }) {
  const messages = (field.value as ChatMessage[] | undefined) || []

  if (!messages.length) {
    return <div className="py-8 text-center text-muted-foreground text-sm">No messages yet</div>
  }

  return (
    <div className="space-y-4 py-2">
      {messages.map((msg, i) => {
        const isUser = msg.role === 'user'
        return (
          <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%] sm:max-w-[75%]">
              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${ROLE_STYLES[msg.role] || ROLE_STYLES.agent}`}>
                {isUser ? msg.content : <Markdown>{msg.content}</Markdown>}
              </div>
              {msg.escalationReason && (
                <div className="text-[10px] text-amber-500 mt-1 italic">
                  Escalation: {msg.escalationReason}
                </div>
              )}
              <div className={`text-[10px] text-muted-foreground mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
