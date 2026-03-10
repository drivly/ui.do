import { ChatStreamControl } from '../components/controls/ChatStreamControl'
import type { ILayerField } from '../types'

interface Props {
  appName: string
  endpoint?: string
}

export function ChatOverboardView({ appName, endpoint }: Props) {
  const field: ILayerField = {
    id: 'chat-overboard',
    label: appName,
    type: 'chat-stream',
    placeholder: `Ask anything about ${appName}...`,
    link: endpoint ? { address: endpoint } : undefined,
  }

  return (
    <div className="flex flex-col h-full">
      <ChatStreamControl field={field} />
    </div>
  )
}
