import { useEffect, useState } from 'react'

export type Loaded<T> =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T }

/**
 * Runs `load` when the screen opens (and again on `reload()`), keeping the
 * result in state. `load` must come from useCallback so it only changes when
 * its inputs change; otherwise it would reload on every render.
 */
export function useLoad<T>(load: () => Promise<T>): Loaded<T> & { reload: () => void } {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true // ignores a slow answer that arrives after leaving the screen
    load().then(
      (data) => active && setState({ status: 'ready', data }),
      (error: unknown) =>
        active &&
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Erro ao carregar.',
        }),
    )
    return () => {
      active = false
    }
  }, [load, version])

  return { ...state, reload: () => setVersion((v) => v + 1) }
}
