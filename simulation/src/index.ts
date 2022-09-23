import { ExperimentRunner, ProtocolStrategy, RunConfig } from './experimentRunner'
import fs from 'fs'

let checkpoint: { checkpoint: number; name: string }
try {
  checkpoint = JSON.parse(fs.readFileSync('./checkpoint.json').toString())
} catch (err) {
  checkpoint = { checkpoint: 0, name: './outputs/' + new Date().toISOString() }
}

let configs: RunConfig[] = []
const debug = false
const fullExport = false
const useCheckpoint = true
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
  const strategies = [ProtocolStrategy.Optimistic, ProtocolStrategy.Eager, ProtocolStrategy.Strawman]
  const depths = [7, 6, 5, 4]

  for (const strategy of strategies) {
    for (let retry = 0; retry < retries; retry++) {
      for (const failure of [0, 0.000025, 0.00005, 0.000075, 0.0001]) {
        configs.push(
          Object.assign({}, baseConfig, {
            failureRate: failure,
            seed: `${strategy}-f${failure}-s5-d6-c0-${configs.length}`,
          })
        )
      }
    }
    for (let retry = 0; retry < retries; retry++) {
      for (const size of [3, 4, 5, 6]) {
        configs.push(
          Object.assign({}, baseConfig, {
            groupSize: size,
            seed: `${strategy}-f0.00005-s${size}-d6-c0-${configs.length}`,
          })
        )
      }
    }
    for (let retry = 0; retry < retries; retry++) {
      for (const depth of depths) {
        configs.push(
          Object.assign({}, baseConfig, { depth, seed: `${strategy}-f0.00005-s5-d${depth}-c0-${configs.length}` })
        )
      }
    }
  }
}

const runner = new ExperimentRunner(configs.slice(useCheckpoint ? checkpoint.checkpoint : 0), {
  debug,
  fullExport,
  intermediateExport: 1,
  checkpoint: useCheckpoint && checkpoint,
})
runner.run()
