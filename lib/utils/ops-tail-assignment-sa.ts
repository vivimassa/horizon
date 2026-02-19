/**
 * Simulated Annealing optimizer for ops tail assignment.
 * Re-exports from the shared SA engine — both Network and Ops
 * use the same AssignableFlight interface.
 */

export {
  runSimulatedAnnealing,
  SA_PRESETS,
  type SAConfig,
  type SAProgress,
  type SAResult,
} from './tail-assignment-sa'
