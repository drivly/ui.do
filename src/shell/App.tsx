import { useEffect, useMemo, useSyncExternalStore } from 'react'
import Shell from './Shell'
import { createStore } from '../rho/store'
import ListView from '../views/ListView'
import DetailView from '../views/DetailView'
import FormView from '../views/FormView'
import ChatView from '../views/ChatView'

export default function App() {
  const store = useMemo(() => createStore(), [])

  // Register default DEFS (browser target factory)
  useEffect(() => {
    store.registerDef('collection', ListView)
    store.registerDef('entity', DetailView)
    store.registerDef('form', FormView)
    store.registerDef('chat', ChatView)
  }, [store])

  // Subscribe to store changes
  useSyncExternalStore(store.subscribe, store.getSnapshot)

  // Walk from root on mount
  useEffect(() => {
    store.followLink('/arest/').catch(console.error)
  }, [store])

  // Connect SSE for live updates
  useEffect(() => {
    const evtSource = new EventSource('/arest/events')
    evtSource.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data)
        store.applyEvent(event)
      } catch {}
    }
    evtSource.onerror = () => evtSource.close()
    return () => evtSource.close()
  }, [store])

  return <Shell store={store} />
}
