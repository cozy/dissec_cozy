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
  const failureRates = [0, 0.00005, 0.0001, 0.0002, 0.0004]
  const sizes = [3, 5, 7]
  const depths = [3, 4, 5]

  for (const strategy of [ProtocolStrategy.Optimistic, ProtocolStrategy.Pessimistic, ProtocolStrategy.Eager]) {
    for (const failure of failureRates) {
      for (const size of sizes) {
        for (const depth of depths) {
          for (let i = 0; i < 100; i++) {
            configs.push({
              strategy: strategy,
              selectivity: 0.1,
              maxToAverageRatio: 10,
              averageLatency: 100,
              averageCryptoTime: 100,
              averageComputeTime: 100,
              failCheckPeriod: 100,
              healthCheckPeriod: 3,
              multicastSize: 5,
              deadline: 100 * 2000,
              failureRate: failure,
              depth: depth,
              fanout: 4,
              groupSize: size,
              seed: `${strategy}-f${failure}-s${size}-d${depth}-${i}`,
            })
          }
        }
      }
    }
  }
}

const runner = new ExperimentRunner(configs, { debug })
runner.run()
