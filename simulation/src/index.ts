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
      failureRate: 0.00005,
      depth: 6,
      fanout: 4,
      groupSize: 5,
      concentration: 0,
      random: true,
      seed: 'OPTI-f0.00005-s5-d6-c0-6',
    },
  ]
} else {
  const baseConfig = {
    strategy: ProtocolStrategy.Optimistic,
    selectivity: 0.1,
    maxToAverageRatio: 10,
    averageLatency: 100,
    averageCryptoTime: 100,
    averageComputeTime: 100,
    failCheckPeriod: 100,
    healthCheckPeriod: 3,
    multicastSize: 5,
    deadline: 75 * 2000,
    failureRate: 0.00005,
    depth: 6,
    fanout: 4,
    groupSize: 5,
    concentration: 0,
    random: true,
    seed: `OPTI-f0.00005-s5-d6-c0-0`,
  }
  const retries = 10

  for (let retry = 0; retry < retries; retry++) {
    for (const strategy of [ProtocolStrategy.Optimistic, ProtocolStrategy.Eager, ProtocolStrategy.Strawman]) {
      for (const depth of [4, 5, 6, 7]) {
        configs.push(
          Object.assign({}, baseConfig, { depth, seed: `${strategy}-f0.00005-s5-d${depth}-c0-${configs.length}` })
        )
      }
      for (const failure of [0, 0.000025, 0.00005, 0.000075, 0.0001]) {
        configs.push(
          Object.assign({}, baseConfig, {
            failureRate: failure,
            seed: `${strategy}-f${failure}-s5-d6-c0-${configs.length}`,
          })
        )
      }
      for (const size of [3, 4, 5, 6]) {
        configs.push(
          Object.assign({}, baseConfig, {
            groupSize: size,
            seed: `${strategy}-f0.00005-s${size}-d6-c0-${configs.length}`,
          })
        )
      }
    }
  }
}

const runner = new ExperimentRunner(configs, { debug, fullExport, intermediateExport: 10 })
runner.run()
