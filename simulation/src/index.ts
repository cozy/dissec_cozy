import { ExperimentRunner, ProtocolStrategy, RunConfig } from './experimentRunner'

let configs: RunConfig[] = []
const debug = false
const fullExport = false
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
      deadline: 200000,
      failureRate: 0.002,
      depth: 3,
      fanout: 4,
      groupSize: 4,
      random: false,
      seed: 'OPTI-f0.002-s4-d3-0/1',
    },
  ]
} else {
  const failureRates = [0, 0.0005, 0.001, 0.0015, 0.002]
  const sizes = [4]
  const depths = [3]
  const retries = 1

  for (const strategy of [ProtocolStrategy.Optimistic, ProtocolStrategy.Pessimistic, ProtocolStrategy.Eager]) {
    for (const failure of failureRates) {
      for (const size of sizes) {
        for (const depth of depths) {
          for (let i = 0; i < retries; i++) {
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
              random: false,
              seed: `${strategy}-f${failure}-s${size}-d${depth}-${i}/${retries}`,
            })
          }
        }
      }
    }
  }
}

const runner = new ExperimentRunner(configs, { debug, fullExport })
runner.run()
