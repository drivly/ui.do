import type { INavigationLayer } from '../types'
import { Link } from 'react-router-dom'

export function NavigationLayer({ layer }: { layer: INavigationLayer }) {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{layer.title}</h1>
      {layer.items.map((list, i) => (
        <div key={i} className="space-y-2">
          {list.items.map((item, j) => (
            <Link key={j} to={(item.link?.address || item.address || '#').replace('/layers/', '/')}
              className="block p-4 bg-white rounded-xl border hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="font-medium text-gray-900">{item.text}</div>
              {item.subtext && <div className="text-sm text-gray-500 mt-1">{item.subtext}</div>}
            </Link>
          ))}
        </div>
      ))}
    </div>
  )
}
