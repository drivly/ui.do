interface Props { onComplete: (slug: string) => void; onCancel: () => void }
export function BuildView({ onCancel }: Props) {
  return <div className="text-gray-500">Build view — coming soon <button onClick={onCancel} className="text-blue-600 underline ml-2">Cancel</button></div>
}
