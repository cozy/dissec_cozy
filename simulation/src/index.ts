import fs from 'fs'

import { ExperimentRunner, RunConfig, STRATEGIES } from './experimentRunner'
import { createRunConfigs } from './utils'

let checkpoint: { checkpoint: number; name: string; path: string }
const defaultPath = './checkpoint.json'
try {
  checkpoint = JSON.parse(fs.readFileSync(defaultPath).toString())
} catch (err) {
  checkpoint = {
    checkpoint: 0,
    name: './outputs/' + new Date().toISOString().replaceAll(':', ''),
    path: defaultPath
  }
}

let configs: RunConfig[] = []
const debug = true
const fullExport = true
const useCheckpoint = false
if (debug) {
  configs = [
    {
      buildingBlocks: STRATEGIES.ONESHOT,
      selectivity: 0.1,
      maxToAverageRatio: 10,
      averageLatency: 0.033,
      averageBandwidth: 6000,
      averageCryptoTime: 0.01,
      averageComputeTime: 0.00005,
      modelSize: 1024,
      failCheckPeriod: 100,
      healthCheckPeriod: 3,
      multicastSize: 5,
      deadline: 50000000,
      failureRate: 166.666,
      adaptedFailures: false,
      backupsToAggregatorsRatio: 0.2,
      depth: 4,
      fanout: 4,
      groupSize: 4,
      concentration: 0,
      random: true,
      seed: '5-15'
    }
  ]
} else {
  const seedPrefix = ''
  const retries = 20

  configs = [
    ...createRunConfigs({
      strategies: [
        STRATEGIES.STRAWMAN,
        STRATEGIES.EAGER,
        STRATEGIES.ONESHOT,
        STRATEGIES.HYBRID_BLOCK
      ],
      depths: [3, 4, 5],
      failures: [
        0,
        10000.0,
        400.0,
        333.333,
        285.714,
        250.0,
        222.222,
        200.0,
        166.666,
        142.857,
        125.0,
        111.111,
        100.0,
        90.909,
        83.333
      ],
      groupSizes: [4, 5, 6],
      modelSizes: [1, 2 ** 8, 2 ** 10, 2 ** 12, 2 ** 14],
      retries,
      fullSpace: true,
      seedPrefix,
      defaultValues: {
        depth: 4,
        failure: 400,
        groupSize: 5,
        modelSize: 2 ** 10
      }
    })
  ]
}

const runner = new ExperimentRunner(configs, {
  debug,
  fullExport,
  intermediateExport: 100,
  checkpoint: useCheckpoint ? checkpoint : undefined
})
runner.run()
