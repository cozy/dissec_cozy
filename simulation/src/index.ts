import config from '../dissec.config.json'
import { ExperimentRunner, ProtocolStrategy, RunConfig } from './experimentRunner'

let configs: RunConfig[] = []
const debug = true
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
      deadline: 1000000,
      failureRate: 0.0004,
      depth: 3,
      fanout: 4,
      groupSize: 3,
      seed: 'Optimistic:4-1',
    },
  ]
} else {
  configs = [ProtocolStrategy.Optimistic].flatMap(strategy =>
    Array(10)
      .fill(0)
      .flatMap((_, failure) =>
        Array(10)
          .fill(0)
          .map((_, retries) => ({
            strategy: strategy,
            averageLatency: 100,
            maxToAverageRatio: 10,
            averageCryptoTime: 100,
            averageComputeTime: 100,
            healthCheckPeriod: 3,
            multicastSize: 5,
            deadline: 100 * 10000,
            failureRate: 0.0001 * failure,
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
