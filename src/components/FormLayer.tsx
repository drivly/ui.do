import { useRef, useCallback } from 'react'
import type { IFormLayer, IActionButton, ConverterRegistry, ILayerField } from '../types'
import { Fieldset } from './Fieldset'
import { ActionButton } from './ActionButton'
import { Menu } from './Menu'
import { Toolbar } from './Toolbar'

interface Props {
  layer: IFormLayer
  registry: ConverterRegistry
  onAction: (btn: IActionButton) => void
  onNavigate?: (address: string) => void
}

/** Validate a single field against its rules. Returns error messages. */
function validateField(field: ILayerField, value: string): string[] {
  const errors: string[] = []
  const rules = field.validationRules || []

  // Auto-generate required rule if field.required is set
  if (field.required && !rules.some(r => r.type === 'required')) {
    rules.unshift({ type: 'required', message: `${field.label} is required` })
  }

  for (const rule of rules) {
    switch (rule.type) {
      case 'required':
        if (!value.trim()) errors.push(rule.message)
        break
      case 'expression':
        if (rule.expression && value && !new RegExp(rule.expression).test(value)) {
          errors.push(rule.message)
        }
        break
      case 'numeric':
        if (value && isNaN(Number(value))) errors.push(rule.message)
        break
    }
  }
  return errors
}

/** Collect all form values as key-value pairs (matches iFactr GetSubmissionValues) */
function getSubmissionValues(form: HTMLFormElement, layer: IFormLayer): Record<string, string> {
  const formData = new FormData(form)
  const values: Record<string, string> = { ...layer.actionParameters }
  for (const [key, val] of formData.entries()) {
    values[key] = val.toString()
  }
  return values
}

export function FormLayer({ layer, registry, onAction, onNavigate }: Props) {
  const formRef = useRef<HTMLFormElement>(null)

  const handleAction = useCallback((btn: IActionButton) => {
    if (btn.action === 'submit' && formRef.current) {
      const values = getSubmissionValues(formRef.current, layer)
      // Attach submission values to the button for the handler
      onAction({ ...btn, action: 'submit', address: btn.address || btn.link?.address, ...values } as IActionButton & Record<string, string>)
    } else {
      onAction(btn)
    }
  }, [layer, onAction])

  return (
    <div>
      {layer.menu && <Menu menu={layer.menu} onNavigate={onNavigate} />}
      {layer.toolbar && <Toolbar toolbar={layer.toolbar} onNavigate={onNavigate} />}

      <form ref={formRef} onSubmit={e => e.preventDefault()} className="bg-card rounded-xl border border-border p-6">
        {layer.fieldsets.map((fs, i) => <Fieldset key={i} fieldset={fs} registry={registry} />)}
        {layer.actionButtons?.length ? (
          <div className="flex gap-3 mt-6 pt-4 border-t border-border">
            {layer.actionButtons.map(btn => (
              <ActionButton key={btn.id} button={btn} onAction={handleAction} />
            ))}
          </div>
        ) : null}
      </form>

      {layer.navigation?.length ? (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-muted-foreground mb-3">Related</h2>
          <div className="space-y-2">
            {layer.navigation.map((nav, i) => (
              <button key={i} onClick={() => onNavigate?.(nav.link?.address || nav.address || '')}
                className="block w-full text-left p-3 bg-card rounded-lg border border-border hover:border-primary-300 dark:hover:border-primary-700 transition-colors text-sm text-card-foreground">
                <div className="flex items-center justify-between">
                  <span>{nav.text}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground flex-shrink-0"><path d="m9 18 6-6-6-6"/></svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// Export validation utilities for external use
export { validateField, getSubmissionValues }
