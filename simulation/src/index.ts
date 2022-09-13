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
      deadline: 150000,
      failureRate: 0.0004,
      depth: 5,
      fanout: 4,
      groupSize: 3,
      concentration: 0,
      random: false,
      seed: 'OPTI-f0.0004-s3-d5-c0-0/1',
    },
  ]
} else {
  const failureRates = [0, 0.0005, 0.001]
  const sizes = [3]
  const depths = [3]
  const concentrations = [0]
  const retries = 100

  for (const strategy of [ProtocolStrategy.Optimistic, ProtocolStrategy.Eager]) {
    for (const failure of failureRates) {
      for (const size of sizes) {
        for (const depth of depths) {
          for (const concentration of concentrations) {
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
                deadline: 75 * 2000,
                failureRate: failure,
                depth: depth - concentration,
                fanout: 4,
                groupSize: size,
                concentration,
                random: false,
                seed: `${strategy}-f${failure}-s${size}-d${depth}-c${concentration}-${i}/${retries}`,
              })
            }
          }
        }
      }
    }
  }
}

const runner = new ExperimentRunner(configs, { debug, fullExport, intermediateExport: undefined })
runner.run()
