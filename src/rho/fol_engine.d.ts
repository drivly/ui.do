/* tslint:disable */
/* eslint-disable */

/**
 * AREST: Apply a command to the current population.
 * One function application. One state transfer.
 * Returns the complete result: entities, status, transitions, violations, derived facts.
 */
export function apply_command_wasm(command_val: any, population_val: any): any;

/**
 * Debug: return the compiled model state (noun-to-SM mapping)
 */
export function debug_compiled_state(): any;

export function evaluate_response(response_val: any, population_val: any): any;

export function forward_chain_population(population_val: any): any;

/**
 * Get the field-to-schema mapping for a noun.
 * Returns all compiled graph schemas where this noun plays role 0 (entity role),
 * mapped by the role 1 noun name (the field name).
 *
 * This is the schema metadata needed by the TypeScript layer to understand
 * how entity fields map to compiled constructions.
 */
export function get_noun_schemas_wasm(noun_name: string): any;

/**
 * Get valid transitions from a given status in a compiled state machine.
 * Returns JSON: [{ "from": "status", "to": "target", "event": "eventName" }]
 */
export function get_transitions_wasm(noun_name: string, current_status: string): any;

/**
 * Induce constraints and rules from a population.
 * Given observed facts, discover the UC, MC, FC, SS constraints and
 * derivation rules that govern the data. This is the inverse of evaluation.
 */
export function induce_from_population(population_val: any): any;

export function load_ir(ir_json: string): void;

/**
 * Load the validation model (compiled from core.md + validation.md).
 * Called once at startup. The validation model persists across domain loads.
 */
export function load_validation_model(ir_json: string): void;

/**
 * Prepare entity creation: given a noun name, return the initial state
 * and any constraint violations. This is a single function application —
 * the engine evaluates state machine initialization, deontic checks, and
 * derivation rules in one call.
 *
 * Returns JSON: { initialState: "Draft" | null, violations: [...], derivedFacts: [...] }
 */
export function prepare_entity(noun_name: string, _fields_val: any, population_val: any): any;

/**
 * Project an entity's fields into facts using compiled graph schema references.
 *
 * This is α(project) applied to the 3NF row: for each field, find the compiled
 * schema where this noun plays role 0 and the field name matches role 1's noun name,
 * then produce a fact with the compiled schema ID and proper bindings.
 *
 * Fields that don't match a compiled schema are included with provisional IDs
 * (the reading format: "Noun has field"). System fields (starting with _) are excluded.
 */
export function project_entity_wasm(noun_name: string, entity_id: string, fields_val: any): any;

/**
 * Prove a goal fact via backward chaining.
 * Returns a ProofResult with status (Proven/Disproven/Unknown) and proof tree.
 */
export function prove_goal(goal: string, population_val: any, world_assumption: string): any;

export function query_population_wasm(population_val: any, predicate_val: any): any;

/**
 * Query a population using the AST-based partial application model.
 *
 * schema_id: the fact type ID to query
 * target_role: 1-indexed role to extract from matching facts
 * filter_json: array of [role_index, value] pairs to filter by
 * population_json: the population to query
 *
 * Returns JSON: { "matches": ["value1", "value2", ...], "count": N }
 */
export function query_schema_wasm(schema_id: string, target_role: number, filter_val: any, population_val: any): any;

/**
 * Given a fact type ID, resolve what event should fire on which state machine.
 * Returns JSON: { "factTypeId": "...", "eventName": "...", "targetNoun": "..." } or null.
 */
export function resolve_fact_event(fact_type_id: string): any;

/**
 * Run RMAP (Relational Mapping Procedure) on the loaded IR.
 * Returns table definitions as JSON.
 */
export function rmap_wasm(): any;

/**
 * Run a compiled state machine by folding events through the transition function.
 * Events are [(event_name, payload)] pairs. Returns the final state.
 */
export function run_machine_wasm(noun_name: string, events_val: any, _population_val: any): any;

export function synthesize_noun(noun_name: string, depth: number): any;

/**
 * Validate a domain IR against the validation model.
 * Takes domain IR as JSON string, converts to metamodel population,
 * evaluates validation constraints. Returns JS array of violations.
 */
export function validate_schema_wasm(domain_ir_json: string): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly apply_command_wasm: (a: any, b: any) => [number, number, number];
    readonly debug_compiled_state: () => any;
    readonly evaluate_response: (a: any, b: any) => [number, number, number];
    readonly forward_chain_population: (a: any) => [number, number, number];
    readonly get_noun_schemas_wasm: (a: number, b: number) => any;
    readonly get_transitions_wasm: (a: number, b: number, c: number, d: number) => any;
    readonly induce_from_population: (a: any) => [number, number, number];
    readonly load_ir: (a: number, b: number) => [number, number];
    readonly load_validation_model: (a: number, b: number) => [number, number];
    readonly prepare_entity: (a: number, b: number, c: any, d: any) => [number, number, number];
    readonly project_entity_wasm: (a: number, b: number, c: number, d: number, e: any) => [number, number, number];
    readonly prove_goal: (a: number, b: number, c: any, d: number, e: number) => [number, number, number];
    readonly query_population_wasm: (a: any, b: any) => [number, number, number];
    readonly query_schema_wasm: (a: number, b: number, c: number, d: any, e: any) => [number, number, number];
    readonly resolve_fact_event: (a: number, b: number) => any;
    readonly rmap_wasm: () => any;
    readonly run_machine_wasm: (a: number, b: number, c: any, d: any) => [number, number, number];
    readonly synthesize_noun: (a: number, b: number, c: number) => any;
    readonly validate_schema_wasm: (a: number, b: number) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
