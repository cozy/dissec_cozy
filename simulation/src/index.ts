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
      failureRate: 333.333,
      adaptedFailures: false,
      backupsToAggregatorsRatio: 0.2,
      depth: 4,
      fanout: 8,
      groupSize: 5,
      concentration: 0,
      random: false,
      seed: '12',
    },
  ]
} else {
  configs = createRunConfigs({
    strategies: [STRATEGIES.STRAWMAN, STRATEGIES.EAGER, STRATEGIES.ONESHOT, STRATEGIES.HYBRID_UTIL],
    depths: [4],
    failures: [0, 6400, 400, 333.333, 285.714, 250.0, 222.222, 200.0, 125.0, 111.111, 100, 90.9, 83.333],
    modelSizes: Array(4)
      .fill(0)
      .map((_, i) => 2 ** (8 + 2 * i)),
    backupsToAggregatorsRatios: [0.2],
    retries: 50,
    fullSpace: false,
    defaultValues: {
      depth: 4,
      failure: 400,
      modelSize: 2 ** 10,
      backupsToAggregatorsRatio: 0.2,
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
