import fs from 'fs'

import { defaultConfig, ExperimentRunner, RunConfig, STRATEGIES } from './experimentRunner'

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
const fullExport = true
const useCheckpoint = false
if (debug) {
  configs = [
    {
      buildingBlocks: STRATEGIES.ONESHOT,
      selectivity: 0.1,
      maxToAverageRatio: 10,
      averageLatency: 10,
      averageCryptoTime: 10,
      averageComputeTime: 5,
      modelSize: 100,
      failCheckPeriod: 100,
      healthCheckPeriod: 3,
      multicastSize: 5,
      deadline: 50000000,
      failureRate: 3000000,
      depth: 3,
      fanout: 8,
      groupSize: 5,
      concentration: 0,
      random: false,
      seed: '0',
    },
  ]
} else {
  const baseConfig = defaultConfig()
  const retries = 2
  // const strategies = [ProtocolStrategy.Optimistic, ProtocolStrategy.Eager, ProtocolStrategy.Strawman]
  // const depths = [7, 6, 5, 4]

  for (const failure of Array(5)
    .fill(0)
    .map((_, i) => i * 10 ** 6)) {
    for (const modelSize of Array(4)
      .fill(0)
      .map((_, i) => 10 ** i)) {
      for (let retry = 0; retry < retries; retry++) {
        configs.push(
          Object.assign({}, baseConfig, {
            failureRate: failure,
            modelSize,
            seed: `${retry}`,
          })
        )
      }
    }
  }

  // for (let retry = 0; retry < retries; retry++) {
  //   for (const strategy of strategies) {
  //     for (const failure of [0.0, 0.00007, 0.00014, 0.00024]) {
  //       configs.push(
  //         Object.assign({}, baseConfig, {
  //           strategy,
  //           failureRate: failure,
  //           seed: `${strategy}-f${failure}-s5-d6-c0-${configs.length}`,
  //         })
  //       )
  //     }
  //     for (const size of [3, 4, 5, 6]) {
  //       configs.push(
  //         Object.assign({}, baseConfig, {
  //           strategy,
  //           groupSize: size,
  //           seed: `${strategy}-f0.00007-s${size}-d6-c0-${configs.length}`,
  //         })
  //       )
  //     }
  //     for (const depth of depths) {
  //       configs.push(
  //         Object.assign({}, baseConfig, {
  //           strategy,
  //           depth,
  //           seed: `${strategy}-f0.00007-s5-d${depth}-c0-${configs.length}`,
  //         })
  //       )
  //     }
  //   }
  // }
}

const runner = new ExperimentRunner(configs, {
  debug,
  fullExport,
  intermediateExport: 0,
  checkpoint: useCheckpoint ? checkpoint : undefined,
})
runner.run()
