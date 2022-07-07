import { ExperimentRunner, ProtocolStrategy, RunConfig } from './experimentRunner'

let configs: RunConfig[] = []
const debug = false
if (debug) {
  configs = [
    {
      strategy: ProtocolStrategy.Optimistic,
      selectivity: 0.1,
      maxToAverageRatio: 10,
      averageLatency: 100,
      averageCryptoTime: 100,
      averageComputeTime: 100,
      failCheckPeriod: 100,
      healthCheckPeriod: 3,
      multicastSize: 5,
      deadline: 500000,
      failureRate: 0.001,
      depth: 3,
      fanout: 4,
      groupSize: 3,
      seed: 'OPTI-2-8',
    },
  ]
} else {
  configs = [ProtocolStrategy.Eager, ProtocolStrategy.Optimistic, ProtocolStrategy.Pessimistic].flatMap(strategy =>
    Array(5)
      .fill(0)
      .flatMap((_, failure) =>
        Array(10)
          .fill(0)
          .map((_, retries) => ({
            strategy: strategy,
            selectivity: 0.1,
            maxToAverageRatio: 10,
            averageLatency: 100,
            averageCryptoTime: 100,
            averageComputeTime: 100,
            failCheckPeriod: 100,
            healthCheckPeriod: 3,
            multicastSize: 5,
            deadline: 100 * 5000,
            failureRate: 0.0005 * failure,
            depth: 3,
            fanout: 4,
            groupSize: 3,
            seed: `${strategy}-${failure}-${retries}`,
          }))
      )
  )
}

const runner = new ExperimentRunner(configs, { debug })
runner.run()
