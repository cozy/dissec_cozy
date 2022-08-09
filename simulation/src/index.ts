import { ExperimentRunner, ProtocolStrategy, RunConfig } from './experimentRunner'

let configs: RunConfig[] = []
const debug = false
const fullExport = false
if (debug) {
  configs = [
    {
      strategy: ProtocolStrategy.Pessimistic,
      selectivity: 0.1,
      maxToAverageRatio: 10,
      averageLatency: 100,
      averageCryptoTime: 100,
      averageComputeTime: 100,
      failCheckPeriod: 100,
      healthCheckPeriod: 3,
      multicastSize: 5,
      deadline: 200000,
      failureRate: 0.0002,
      depth: 3,
      fanout: 4,
      groupSize: 3,
      random: false,
      seed: 'PESS-f0.0002-s3-d3-0/1',
    },
  ]
} else {
  const failureRates = [0, 0.00005, 0.0001, 0.00015, 0.0002]
  const sizes = [4, 5, 6]
  const depths = [3, 4, 5]
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
