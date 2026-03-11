import { ChatStreamControl, type ChatEmptyStateProps } from '../components/controls/ChatStreamControl'
import type { ILayerField } from '../types'

interface Props {
  appName: string
  appSlug: string
  endpoint?: string
}

const SUGGESTED_PROMPTS = [
  { label: 'What plans do you offer?', icon: '📋' },
  { label: 'What APIs can I access?', icon: '🔌' },
  { label: 'How do I decode a VIN?', icon: '🚗' },
  { label: 'What is my current plan?', icon: '👤' },
]

function SupportSplash({ appName, sendMessage }: { appName: string } & ChatEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center mt-16 px-4">
      <div className="text-5xl mb-5">💬</div>
      <h2 className="text-lg font-semibold text-foreground mb-1">
        Welcome to {appName}
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mb-8">
        Ask a question about your API subscription, billing, vehicle data, or anything else.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
        {SUGGESTED_PROMPTS.map((item) => (
          <button
            key={item.label}
            onClick={() => sendMessage(item.label)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-card/50 text-sm text-muted-foreground hover:bg-card hover:text-foreground hover:border-primary-500/50 transition-colors cursor-pointer text-left"
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function ChatOverboardView({ appName, appSlug, endpoint }: Props) {
  const field: ILayerField = {
    id: 'chat-overboard',
    label: appName,
    type: 'chat-stream',
    placeholder: `Ask anything about ${appName}...`,
    link: endpoint ? { address: endpoint } : undefined,
  }

  return (
    <div className="flex flex-col h-full">
      <ChatStreamControl
        field={field}
        appSlug={appSlug}
        emptyState={({ sendMessage }) => <SupportSplash appName={appName} sendMessage={sendMessage} />}
      />
    </div>
  )
}
