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
      buildingBlocks: STRATEGIES.HYBRID_UTIL,
      selectivity: 0.1,
      maxToAverageRatio: 10,
      averageLatency: 0.033,
      averageBandwidth: 6000,
      averageCryptoTime: 0.01,
      averageComputeTime: 0.00005,
      modelSize: 1000,
      failCheckPeriod: 100,
      healthCheckPeriod: 3,
      multicastSize: 5,
      deadline: 50000000,
      failureRate: 34,
      adaptedFailures: true,
      backupsToAggregatorsRatio: 0.1,
      depth: 3,
      fanout: 8,
      groupSize: 5,
      concentration: 0,
      random: false,
      seed: '3',
    },
  ]
} else {
  configs = createRunConfigs({
    strategies: [
      STRATEGIES.EAGER,
      STRATEGIES.ONESHOT,
      STRATEGIES.HYBRID_UTIL,
      STRATEGIES.HYBRID_2,
      STRATEGIES.HYBRID_3,
    ],
    depths: [3, 4, 5],
    failures: [30, 34, 38, 42, 46, 50, 54, 58, 62, 66, 70],
    modelSizes: Array(4)
      .fill(0)
      .map((_, i) => 2 ** (10 + 2 * i)),
    backupsToAggregatorsRatios: [0.1],
    retries: 5,
    fullSpace: false,
    defaultValues: {
      depth: 4,
      failure: 50,
      modelSize: 2 ** 10,
      backupsToAggregatorsRatio: 0.1,
    },
  })
}

const runner = new ExperimentRunner(configs, {
  debug,
  fullExport,
  intermediateExport: 0,
  checkpoint: useCheckpoint ? checkpoint : undefined,
})
runner.run()
