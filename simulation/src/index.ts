import { ExperimentRunner, ProtocolStrategy, RunConfig } from './experimentRunner'

let configs: RunConfig[] = []
const debug = false
if (debug) {
  configs = [
    {
      strategy: ProtocolStrategy.Pessimistic,
      selectivity: 0.1,
      averageLatency: 100,
      maxToAverageRatio: 10,
      averageCryptoTime: 100,
      averageComputeTime: 100,
      healthCheckPeriod: 3,
      multicastSize: 5,
      deadline: 500000,
      failureRate: 0.0016,
      depth: 3,
      fanout: 4,
      groupSize: 3,
      seed: 'PESS-4-9',
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
            averageLatency: 100,
            maxToAverageRatio: 10,
            averageCryptoTime: 100,
            averageComputeTime: 100,
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
