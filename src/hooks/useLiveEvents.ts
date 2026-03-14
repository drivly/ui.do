import { useEffect, useRef, useCallback } from 'react'

const API_URL = new URLSearchParams(window.location.search).get('api') || 'https://api.auto.dev'
const WS_URL = API_URL.replace('https://', 'wss://').replace('http://', 'ws://')

/** Subscribe to live CDC events from GraphDL via WebSocket */
export function useLiveEvents(
  domainId: string | undefined,
  onEvent: (event: { type: string; operation: string; table: string; id: string; domain?: string }) => void,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const connect = useCallback(() => {
    if (!domainId) return

    const ws = new WebSocket(`${WS_URL}/graphdl/ws?domain=${domainId}`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'cdc') {
          onEventRef.current(data)
        }
      } catch { /* ignore */ }
    }

    ws.onclose = () => {
      wsRef.current = null
      // Reconnect after 3 seconds
      setTimeout(() => {
        if (document.visibilityState !== 'hidden') connect()
      }, 3000)
    }

    ws.onerror = () => ws.close()
  }, [domainId])

  useEffect(() => {
    connect()

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        wsRef.current?.close()
      } else if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connect()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])
}
