/**
 * ArestView — renders AREST engine responses by following _links.
 *
 * No layer templates. No hardcoded routes. The representation IS the UI.
 * - GET collection → list view
 * - GET entity → detail view with fields
 * - _links with method POST → action buttons (transitions)
 * - _links with GET → navigation
 *
 * The client discovers the app by following links from the entry point.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  listEntities, getEntity, fireTransition, createEntity,
  getTransitionLinks, getNavigationLinks, getEntityFields,
  type ArestEntity, type ArestListResult, type ArestLink,
} from '../arest'
import { formatNounName } from '../utils'

interface ArestViewProps {
  noun: string
  domain: string
  onNavigate?: (noun: string, id?: string) => void
}

export function ArestView({ noun, domain, onNavigate }: ArestViewProps) {
  const [list, setList] = useState<ArestListResult | null>(null)
  const [selected, setSelected] = useState<ArestEntity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listEntities(noun, domain)
      setList(result)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }, [noun, domain])

  useEffect(() => {
    setSelected(null)
    loadList()
  }, [loadList])

  const selectEntity = useCallback(async (entity: ArestEntity) => {
    const selfLink = entity._links?.self
    if (selfLink) {
      const full = await getEntity(selfLink)
      if (full) { setSelected(full); return }
    }
    setSelected(entity)
  }, [])

  const handleTransition = useCallback(async (link: ArestLink, event: string) => {
    try {
      const result = await fireTransition(link, event)
      if (result.rejected) {
        setError(`Rejected: ${result.violations.map(v => v.constraintText).join(', ')}`)
        return
      }
      // Refresh the selected entity and the list
      if (selected?._links?.self) {
        const refreshed = await getEntity(selected._links.self)
        if (refreshed) setSelected(refreshed)
      }
      loadList()
    } catch (e: any) {
      setError(e.message)
    }
  }, [selected, loadList])

  const handleCreate = useCallback(async (data: Record<string, string>) => {
    try {
      const entity = await createEntity(noun, domain, data)
      setCreating(false)
      loadList()
      setSelected(entity as ArestEntity)
    } catch (e: any) {
      setError(e.message)
    }
  }, [noun, domain, loadList])

  if (loading && !list) return <div className="p-4 text-zinc-500">Loading...</div>
  if (error) return <div className="p-4 text-red-500">{error}</div>

  return (
    <div className="flex h-full">
      {/* List panel */}
      <div className="w-80 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto shrink-0">
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold text-sm">{formatNounName(noun)}</h2>
          <button
            onClick={() => setCreating(true)}
            className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            New
          </button>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {list?.docs.map(entity => (
            <button
              key={entity.id}
              onClick={() => selectEntity(entity)}
              className={`w-full text-left p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                selected?.id === entity.id ? 'bg-zinc-100 dark:bg-zinc-800' : ''
              }`}
            >
              <div className="font-medium truncate">{entity.id}</div>
              <div className="text-xs text-zinc-500 truncate">
                {Object.entries(getEntityFields(entity)).slice(0, 2).map(([k, v]) =>
                  `${k}: ${v}`
                ).join(' · ')}
              </div>
            </button>
          ))}
          {list?.docs.length === 0 && (
            <div className="p-4 text-sm text-zinc-400">No {formatNounName(noun).toLowerCase()} found</div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto">
        {creating ? (
          <CreateForm noun={noun} onSubmit={handleCreate} onCancel={() => setCreating(false)} />
        ) : selected ? (
          <EntityDetail
            entity={selected}
            onTransition={handleTransition}
            onNavigate={onNavigate}
          />
        ) : (
          <div className="p-8 text-zinc-400 text-sm">Select an entity or create a new one</div>
        )}
      </div>
    </div>
  )
}

// ── Entity Detail ───────────────────────────────────────────────────

function EntityDetail({
  entity,
  onTransition,
  onNavigate,
}: {
  entity: ArestEntity
  onTransition: (link: ArestLink, event: string) => void
  onNavigate?: (noun: string, id?: string) => void
}) {
  const fields = getEntityFields(entity)
  const transitions = getTransitionLinks(entity)
  const navLinks = getNavigationLinks(entity)

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{entity.id}</h2>
          <div className="text-xs text-zinc-500">{entity.type} · v{entity.version}</div>
        </div>
        {/* Transition buttons — derived from _links */}
        {transitions.length > 0 && (
          <div className="flex gap-2">
            {transitions.map(({ event, link }) => (
              <button
                key={event}
                onClick={() => onTransition(link, event)}
                className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                {event}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fields */}
      <div className="border rounded-lg border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
        {Object.entries(fields).map(([key, value]) => (
          <div key={key} className="flex px-4 py-2.5 text-sm">
            <span className="w-40 shrink-0 text-zinc-500 font-medium">{key}</span>
            <span className="text-zinc-900 dark:text-zinc-100 break-all">
              {value === null || value === undefined ? (
                <span className="text-zinc-300">—</span>
              ) : typeof value === 'object' ? (
                JSON.stringify(value)
              ) : (
                String(value)
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Navigation links */}
      {Object.keys(navLinks).length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Links</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(navLinks).map(([name, href]) => (
              <button
                key={name}
                onClick={() => {
                  // Parse noun/id from href for navigation
                  const match = href.match(/\/api\/entities\/([^/]+)(?:\/([^?]+))?/)
                  if (match && onNavigate) {
                    onNavigate(decodeURIComponent(match[1]), match[2])
                  }
                }}
                className="text-xs px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs text-zinc-400 space-y-0.5">
        {entity.createdAt && <div>Created: {entity.createdAt}</div>}
        {entity.updatedAt && <div>Updated: {entity.updatedAt}</div>}
      </div>
    </div>
  )
}

// ── Create Form ─────────────────────────────────────────────────────

function CreateForm({
  noun,
  onSubmit,
  onCancel,
}: {
  noun: string
  onSubmit: (data: Record<string, string>) => void
  onCancel: () => void
}) {
  const [fields, setFields] = useState<Record<string, string>>({})

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">New {formatNounName(noun)}</h2>
        <button onClick={onCancel} className="text-sm text-zinc-500 hover:text-zinc-700">Cancel</button>
      </div>
      <div className="space-y-3">
        {/* Dynamic field input — user adds fields */}
        {Object.entries(fields).map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <input
              value={key}
              onChange={e => {
                const newFields = { ...fields }
                delete newFields[key]
                newFields[e.target.value] = value
                setFields(newFields)
              }}
              className="w-40 px-2 py-1.5 text-sm border rounded border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="field name"
            />
            <input
              value={value}
              onChange={e => setFields({ ...fields, [key]: e.target.value })}
              className="flex-1 px-2 py-1.5 text-sm border rounded border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="value"
            />
          </div>
        ))}
        <button
          onClick={() => setFields({ ...fields, [`field${Object.keys(fields).length + 1}`]: '' })}
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          + Add field
        </button>
      </div>
      <button
        onClick={() => onSubmit(fields)}
        className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
      >
        Create
      </button>
    </div>
  )
}
