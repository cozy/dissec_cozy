import config from '../dissec.config.json'
import { ExperimentRunner, ProtocolStrategy, RunConfig } from './experimentRunner'

let configs: RunConfig[] = []
const debug = false
if (debug) {
  configs = [
    {
      strategy: ProtocolStrategy.Eager,
      averageLatency: 100,
      maxToAverageRatio: 10,
      averageCryptoTime: 100,
      averageComputeTime: 100,
      healthCheckPeriod: 3,
      multicastSize: 5,
      deadline: 500000,
      failureRate: 0.0001,
      depth: 3,
      fanout: 4,
      groupSize: 3,
      seed: 'EAGER:0-0',
    },
  ]
} else {
  configs = [ProtocolStrategy.Eager, ProtocolStrategy.Optimistic].flatMap(strategy =>
    Array(10)
      .fill(0)
      .flatMap((_, failure) =>
        Array(25)
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
            failureRate: 0.00005 * failure,
            depth: 3,
            fanout: 4,
            groupSize: 3,
            seed: `${strategy}-${failure}-${retries}`,
          }))
      )
  )
}

const runner = new ExperimentRunner(configs, { debug })
runner.run(config.dataPath)
