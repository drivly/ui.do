import { useState, useEffect, useCallback, useRef } from 'react'
import { ChatStreamControl, type ChatEmptyStateProps, type ChatStreamHandle } from '../components/controls/ChatStreamControl'
import { fetchRequestState, sendStateEvent, createReading, fetchEntityInstances } from '../api'
import type { ILayerField } from '../types'

interface Props {
  appName: string
  appSlug: string
  endpoint?: string
  requestId?: string | null
  domainId?: string
  onSelectRequest?: (id: string) => void
  onStateChange?: () => void
}

const SUGGESTED_PROMPTS = [
  { label: 'What plans do you offer?', icon: '📋' },
  { label: 'What APIs can I access?', icon: '🔌' },
  { label: 'How do I decode a VIN?', icon: '🚗' },
  { label: 'What is my current plan?', icon: '👤' },
]

const EVENT_LABELS: Record<string, { label: string; style: string }> = {
  triage: { label: 'Triage', style: 'bg-blue-600 hover:bg-blue-700 text-white' },
  investigate: { label: 'Investigate', style: 'bg-blue-600 hover:bg-blue-700 text-white' },
  resolve: { label: 'Resolve', style: 'bg-green-600 hover:bg-green-700 text-white' },
  reopen: { label: 'Reopen', style: 'bg-amber-600 hover:bg-amber-700 text-white' },
  escalate: { label: 'Escalate', style: 'bg-red-600 hover:bg-red-700 text-white' },
  requestInfo: { label: 'Request Info', style: 'bg-violet-600 hover:bg-violet-700 text-white' },
  close: { label: 'Close', style: 'bg-gray-600 hover:bg-gray-700 text-white' },
  merge: { label: 'Merge', style: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
}

const STATUS_COLORS: Record<string, string> = {
  Received: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  Triaging: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300',
  Investigating: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  WaitingOnCustomer: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  Resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  Closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
}

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

function RequestActionBar({ requestId, domainId, chatRef, onSelectRequest, onStateChange }: {
  requestId: string
  domainId?: string
  chatRef: React.RefObject<ChatStreamHandle | null>
  onSelectRequest?: (id: string) => void
  onStateChange?: () => void
}) {
  const [currentState, setCurrentState] = useState<string | undefined>()
  const [availableEvents, setAvailableEvents] = useState<string[]>([])
  const [acting, setActing] = useState(false)
  const [showRuleInput, setShowRuleInput] = useState(false)
  const [ruleText, setRuleText] = useState('')
  const [addingRule, setAddingRule] = useState(false)
  const [showMergePicker, setShowMergePicker] = useState(false)
  const [mergeTargets, setMergeTargets] = useState<Array<{ id: string; reference?: string; value?: string; status?: string }>>([])
  const [loadingTargets, setLoadingTargets] = useState(false)

  const loadState = useCallback(async () => {
    const state = await fetchRequestState('SupportRequest', requestId)
    if (state) {
      setCurrentState(state.currentState)
      setAvailableEvents(state.availableEvents || [])
    }
  }, [requestId])

  useEffect(() => {
    setCurrentState(undefined)
    setAvailableEvents([])
    setShowMergePicker(false)
    setShowRuleInput(false)
    loadState()
  }, [loadState])

  const handleAction = useCallback(async (event: string) => {
    if (event === 'merge') {
      // Show merge target picker instead of immediately firing the event
      setShowMergePicker(true)
      setShowRuleInput(false)
      if (domainId && mergeTargets.length === 0) {
        setLoadingTargets(true)
        try {
          const data = await fetchEntityInstances(domainId, 'SupportRequest')
          setMergeTargets(
            data.resources
              .filter(r => r.id !== requestId)
              .map(r => ({ ...r, status: data.statuses.get(r.id) }))
              .filter(r => r.status !== 'Closed')
          )
        } catch (err) {
          console.error('Failed to load merge targets:', err)
        } finally {
          setLoadingTargets(false)
        }
      }
      return
    }
    setActing(true)
    try {
      await sendStateEvent('SupportRequest', requestId, event)
      await loadState()
      onStateChange?.()
    } finally {
      setActing(false)
    }
  }, [requestId, loadState, domainId, mergeTargets.length, onStateChange])

  const handleMerge = useCallback(async (targetId: string) => {
    setActing(true)
    try {
      await sendStateEvent('SupportRequest', requestId, 'merge')
      setShowMergePicker(false)
      onStateChange?.()
      // Navigate to the target request
      onSelectRequest?.(targetId)
    } catch (err) {
      console.error('Failed to merge:', err)
    } finally {
      setActing(false)
    }
  }, [requestId, onSelectRequest, onStateChange])

  const handleRedraft = useCallback(() => {
    chatRef.current?.redraft()
  }, [chatRef])

  const handleAddRule = useCallback(async () => {
    if (!ruleText.trim() || !domainId) return
    setAddingRule(true)
    try {
      await createReading(domainId, ruleText.trim())
      setRuleText('')
      setShowRuleInput(false)
      // Redraft with the new rule in effect
      chatRef.current?.redraft()
    } catch (err) {
      console.error('Failed to add rule:', err)
    } finally {
      setAddingRule(false)
    }
  }, [ruleText, domainId, chatRef])

  if (!currentState && !availableEvents.length) return null

  const statusColor = STATUS_COLORS[currentState || ''] || 'bg-muted text-muted-foreground'

  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-2 px-4 py-2 bg-card/50">
        {currentState && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
            {currentState}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={handleRedraft}
          disabled={acting}
          className="text-xs px-3 py-1 rounded-md font-medium transition-colors bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300 dark:hover:bg-orange-800 disabled:opacity-50"
        >
          Re-draft
        </button>
        <button
          onClick={() => { setShowRuleInput(prev => !prev); setShowMergePicker(false) }}
          disabled={acting}
          className="text-xs px-3 py-1 rounded-md font-medium transition-colors bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-300 dark:hover:bg-amber-800 disabled:opacity-50"
        >
          + Rule
        </button>
        {availableEvents.map(event => {
          const config = EVENT_LABELS[event] || { label: event, style: 'bg-primary-600 hover:bg-primary-700 text-white' }
          return (
            <button
              key={event}
              onClick={() => handleAction(event)}
              disabled={acting}
              className={`text-xs px-3 py-1 rounded-md font-medium transition-colors disabled:opacity-50 ${config.style}`}
            >
              {config.label}
            </button>
          )
        })}
      </div>
      {showRuleInput && (
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
            Add a permanent constraint. The agent will follow this rule for all future responses.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={ruleText}
              onChange={e => setRuleText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddRule()}
              placeholder="It is forbidden that..."
              disabled={addingRule}
              className="flex-1 bg-white dark:bg-input border border-amber-300 dark:border-amber-700 rounded-md px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              onClick={handleAddRule}
              disabled={addingRule || !ruleText.trim()}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-md text-sm font-medium disabled:opacity-50 hover:bg-amber-700 transition-colors"
            >
              {addingRule ? 'Adding...' : 'Apply & Re-draft'}
            </button>
          </div>
        </div>
      )}
      {showMergePicker && (
        <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-950/30 border-t border-indigo-200 dark:border-indigo-800">
          <p className="text-xs text-indigo-700 dark:text-indigo-400 mb-2">
            Close this request as a duplicate. Select the request to keep:
          </p>
          {loadingTargets ? (
            <p className="text-xs text-muted-foreground">Loading requests...</p>
          ) : mergeTargets.length === 0 ? (
            <p className="text-xs text-muted-foreground">No other open requests to merge into.</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {mergeTargets.map(target => (
                <button
                  key={target.id}
                  onClick={() => handleMerge(target.id)}
                  disabled={acting}
                  className="w-full text-left px-3 py-2 rounded-md bg-white dark:bg-input border border-indigo-200 dark:border-indigo-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors disabled:opacity-50"
                >
                  <div className="text-sm text-foreground truncate">{target.reference || target.id}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {target.value && <span className="text-xs text-muted-foreground">{target.value}</span>}
                    {target.status && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLORS[target.status] || 'bg-muted text-muted-foreground'}`}>
                        {target.status}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowMergePicker(false)}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

export function ChatOverboardView({ appName, appSlug, endpoint, requestId, domainId, onSelectRequest, onStateChange }: Props) {
  const chatRef = useRef<ChatStreamHandle>(null)

  const field: ILayerField = {
    id: 'chat-overboard',
    label: appName,
    type: 'chat-stream',
    placeholder: `Ask for help from ${appName}...`,
    link: endpoint ? { address: endpoint } : undefined,
  }

  return (
    <div className="flex flex-col h-full">
      {requestId && <RequestActionBar requestId={requestId} domainId={domainId} chatRef={chatRef} onSelectRequest={onSelectRequest} onStateChange={onStateChange} />}
      <ChatStreamControl
        ref={chatRef}
        field={field}
        appSlug={appSlug}
        requestId={requestId}
        domainId={domainId}
        emptyState={({ sendMessage }) => <SupportSplash appName={appName} sendMessage={sendMessage} />}
      />
    </div>
  )
}
