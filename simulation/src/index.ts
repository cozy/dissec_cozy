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
const debug = true
const fullExport = true
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
      modelSize: 1024,
      failCheckPeriod: 100,
      healthCheckPeriod: 3,
      multicastSize: 5,
      deadline: 50000000,
      failureRate: 80,
      adaptedFailures: true,
      backupToAggregatorsRatio: 0.05,
      depth: 4,
      fanout: 8,
      groupSize: 5,
      concentration: 0,
      random: false,
      seed: '0',
    },
  ]
} else {
  configs = createRunConfigs({
    strategies: [STRATEGIES.EAGER, STRATEGIES.ONESHOT, STRATEGIES.HYBRID_UTIL],
    depths: [3, 4, 5],
    failures: [0, 25, 50, 75, 90],
    modelSizes: Array(5)
      .fill(0)
      .map((_, i) => 2 ** (10 + 2 * i)),
    backupsToAggregatorsRatios: [0.1, 0.2, 0.3],
    retries: 5,
    fullSpace: false,
    defaultValues: {
      depth: 4,
      failure: 25,
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
