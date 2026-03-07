import { describe, it, expect } from 'vitest'
import { defaultRegistry, mergeRegistry, resolveControl } from './converter'
import { TextField } from './TextField'
import { BoolField } from './BoolField'
import { SelectField } from './SelectField'

describe('converter registry', () => {
  it('has all 13 field types', () => {
    const types = ['text', 'email', 'numeric', 'password', 'label', 'slider', 'select', 'bool', 'date', 'multiline', 'chat', 'markdown', 'status']
    for (const t of types) {
      expect(defaultRegistry[t]).toBeDefined()
    }
  })

  it('resolves known types', () => {
    expect(resolveControl('bool', defaultRegistry)).toBe(BoolField)
    expect(resolveControl('select', defaultRegistry)).toBe(SelectField)
  })

  it('falls back to text for unknown types', () => {
    expect(resolveControl('unknown', defaultRegistry)).toBe(TextField)
  })

  it('mergeRegistry returns default when no overrides', () => {
    expect(mergeRegistry()).toBe(defaultRegistry)
    expect(mergeRegistry(undefined)).toBe(defaultRegistry)
  })

  it('mergeRegistry applies overrides', () => {
    const custom = () => null
    const merged = mergeRegistry({ text: custom as any })
    expect(merged.text).toBe(custom)
    expect(merged.bool).toBe(BoolField)
  })
})
