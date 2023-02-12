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
    path: defaultPath,
  }
}

let configs: RunConfig[] = []
const debug = false
const fullExport = false
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
      modelSize: 16384,
      failCheckPeriod: 100,
      healthCheckPeriod: 3,
      multicastSize: 5,
      deadline: 50000000,
      failureRate: 400,
      adaptedFailures: false,
      backupsToAggregatorsRatio: 0.2,
      depth: 4,
      fanout: 8,
      groupSize: 5,
      concentration: 0,
      random: false,
      seed: '2',
    },
  ]
} else {
  const seedPrefix = '4-'
  const retries = 20

  configs = [
    ...createRunConfigs({
      strategies: [STRATEGIES.STRAWMAN, STRATEGIES.EAGER, STRATEGIES.ONESHOT, STRATEGIES.HYBRID_BLOCK],
      depths: [3, 4],
      failures: [0, 10000, 400, 200.0, 100.0],
      groupSizes: [4, 5, 6],
      modelSizes: [1],
      retries,
      fullSpace: true,
      seedPrefix,
      defaultValues: {
        depth: 4,
        failure: 400,
        groupSize: 5,
        modelSize: 2 ** 11,
      },
    }),
  ]
}

const runner = new ExperimentRunner(configs, {
  debug,
  fullExport,
  intermediateExport: 100,
  checkpoint: useCheckpoint ? checkpoint : undefined,
})
runner.run()
