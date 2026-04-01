/**
 * ρ layer — WASM engine lifecycle.
 * The representation function. Maps FFP objects to executables.
 * Client-side ρ is a validation UX, not a security boundary.
 */

let initialized = false

export async function initEngine(): Promise<void> {
  if (initialized) return
  const { default: init } = await import('./fol_engine.js')
  await init({ module_or_path: '/wasm/fol_engine_bg.wasm' })
  initialized = true
}

export async function loadSchema(irJson: string): Promise<void> {
  const { load_ir } = await import('./fol_engine.js')
  load_ir(irJson)
}

export async function applyCommand(command: unknown, populationJson: string): Promise<any> {
  const { apply_command_wasm } = await import('./fol_engine.js')
  return apply_command_wasm(command, populationJson)
}

export async function getTransitions(nounName: string, currentStatus: string): Promise<any[]> {
  const { get_transitions_wasm } = await import('./fol_engine.js')
  return get_transitions_wasm(nounName, currentStatus)
}

export async function derivePopulation(populationJson: string): Promise<any> {
  const { forward_chain_population } = await import('./fol_engine.js')
  return forward_chain_population(populationJson)
}

export async function validateSchema(domainIrJson: string): Promise<any> {
  const { validate_schema_wasm } = await import('./fol_engine.js')
  return validate_schema_wasm(domainIrJson)
}

export function isReady(): boolean {
  return initialized
}
