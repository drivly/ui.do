import type { IActionButton } from '../types'

export function ActionButton({ button, onAction }: { button: IActionButton, onAction: (btn: IActionButton) => void }) {
  return (
    <button
      onClick={() => onAction(button)}
      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
    >
      {button.imagePath && <img src={button.imagePath} alt="" className="inline w-4 h-4 mr-1.5 -mt-0.5" />}
      {button.text}
    </button>
  )
}
