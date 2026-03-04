import type { IActionButton } from '../types'

export function ActionButton({ button, onAction }: { button: IActionButton, onAction: (btn: IActionButton) => void }) {
  return (
    <button
      onClick={() => onAction(button)}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
    >
      {button.text}
    </button>
  )
}
