import config from '../dissec.config.json'
import { ExperimentRunner, ProtocolStrategy, RunConfig } from './experimentRunner'

let configs: RunConfig[] = []
const debug = false
if (debug) {
  configs = [
    {
      strategy: ProtocolStrategy.Optimistic,
      averageLatency: 100,
      maxToAverageRatio: 10,
      averageCryptoTime: 100,
      averageComputeTime: 100,
      healthCheckPeriod: 3,
      multicastSize: 5,
      deadline: 500000,
      failureRate: 0.0005,
      depth: 3,
      fanout: 4,
      groupSize: 3,
      seed: 'OPTI:0-29',
    },
  ]
} else {
  configs = [ProtocolStrategy.Optimistic, ProtocolStrategy.Pessimistic].flatMap(strategy =>
    Array(1)
      .fill(0)
      .flatMap((_, failure) =>
        Array(100)
          .fill(0)
          .map((_, retries) => ({
            strategy: strategy,
            averageLatency: 100,
            maxToAverageRatio: 10,
            averageCryptoTime: 100,
            averageComputeTime: 100,
            healthCheckPeriod: 3,
            multicastSize: 5,
            deadline: 100 * 5000,
            failureRate: 0.0005 * (failure + 1),
            depth: 3,
            fanout: 4,
            groupSize: 3,
            seed: `${strategy}:${failure}-${retries}`,
          }))
      )
  )
}

const runner = new ExperimentRunner(configs, { debug })
runner.run(config.dataPath)
