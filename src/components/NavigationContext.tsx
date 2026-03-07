import { createContext, useContext } from 'react'

type NavigateFn = (address: string) => void

const NavigationContext = createContext<NavigateFn | null>(null)

export const NavigationProvider = NavigationContext.Provider

export function useNavigate(): NavigateFn {
  const navigate = useContext(NavigationContext)
  return navigate || (() => {})
}
