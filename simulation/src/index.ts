import { ExperimentRunner, ProtocolStrategy, RunConfig } from './experimentRunner'
import fs from 'fs'

let checkpoint: { checkpoint: number; name: string; path: string }
const defaultPath = './checkpoint.json'
try {
  checkpoint = JSON.parse(fs.readFileSync(defaultPath).toString())
} catch (err) {
  checkpoint = {
    checkpoint: 0,
    name: './outputs/' + new Date().toISOString().replaceAll(':', ''),
    path: defaultPath,
  }
}

let configs: RunConfig[] = []
const debug = false
const fullExport = false
const useCheckpoint = true
if (debug) {
  configs = [
    {
      strategy: ProtocolStrategy.Eager,
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
      depth: 5,
      fanout: 4,
      groupSize: 5,
      concentration: 0,
      random: true,
      seed: 'EAGER-f0.00005-s5-d5-c0-762',
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
    deadline: 500 * 1000,
    failureRate: 0.00007,
    depth: 6,
    fanout: 4,
    groupSize: 5,
    concentration: 0,
    random: false,
    seed: `OPTI-f0.00005-s5-d6-c0-0`,
  }
  const retries = 5
  const strategies = [ProtocolStrategy.Optimistic, ProtocolStrategy.Eager, ProtocolStrategy.Strawman]
  const depths = [7, 6, 5, 4]

  for (let retry = 0; retry < retries; retry++) {
    for (const strategy of strategies) {
      for (const failure of [0.0, 0.00007, 0.00014, 0.00024]) {
        configs.push(
          Object.assign({}, baseConfig, {
            strategy,
            failureRate: failure,
            seed: `${strategy}-f${failure}-s5-d6-c0-${configs.length}`,
          })
        )
      }
      for (const size of [3, 4, 5, 6]) {
        configs.push(
          Object.assign({}, baseConfig, {
            strategy,
            groupSize: size,
            seed: `${strategy}-f0.00007-s${size}-d6-c0-${configs.length}`,
          })
        )
      }
      for (const depth of depths) {
        configs.push(
          Object.assign({}, baseConfig, {
            strategy,
            depth,
            seed: `${strategy}-f0.00007-s5-d${depth}-c0-${configs.length}`,
          })
        )
      }
    }
  }
}

const runner = new ExperimentRunner(configs.slice(useCheckpoint ? checkpoint.checkpoint : 0), {
  debug,
  fullExport,
  intermediateExport: 1,
  checkpoint: useCheckpoint ? checkpoint : undefined,
})
runner.run()
