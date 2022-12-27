import fs from 'fs'

import { BuildingBlocks, defaultConfig, ExperimentRunner, RunConfig, STRATEGIES } from './experimentRunner'

function createRunConfigs({
  strategies,
  depths,
  failures,
  modelSizes,
  retries,
  fullSpace,
  defaultValues,
}: {
  strategies: BuildingBlocks[]
  depths: number[]
  failures: number[]
  modelSizes: number[]
  retries: number
  fullSpace: boolean
  defaultValues?: {
    depth: number
    failure: number
    modelSize: number
  }
}) {
  let configs = []
  const baseConfig = defaultConfig()

  if (fullSpace) {
    for (let retry = 0; retry < retries; retry++) {
      for (const buildingBlocks of strategies) {
        for (const depth of depths) {
          for (const failure of failures) {
            for (const modelSize of modelSizes) {
              configs.push(
                Object.assign({}, baseConfig, {
                  buildingBlocks,
                  failureRate: failure,
                  modelSize,
                  depth,
                  seed: `${retry}`,
                })
              )
            }
          }
        }
      }
    }
  } else {
    if (!defaultValues) {
      throw new Error('Missing default values')
    }

    for (const retry in new Array(retries).fill(0)) {
      for (const buildingBlocks of strategies) {
        for (const depth of depths) {
          configs.push(
            Object.assign({}, baseConfig, {
              buildingBlocks,
              failureRate: defaultValues.failure,
              modelSize: defaultValues.modelSize,
              depth: depth,
              seed: `${retry}`,
            })
          )
        }

        for (const failure of failures) {
          configs.push(
            Object.assign({}, baseConfig, {
              buildingBlocks,
              failureRate: failure,
              modelSize: defaultValues.modelSize,
              depth: defaultValues.depth,
              seed: `${retry}`,
            })
          )
        }

        for (const modelSize of modelSizes) {
          configs.push(
            Object.assign({}, baseConfig, {
              buildingBlocks,
              failureRate: defaultValues.failure,
              modelSize: modelSize,
              depth: defaultValues.depth,
              seed: `${retry}`,
            })
          )
        }
      }
    }
  }

  return configs
}

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
      buildingBlocks: STRATEGIES.STRAWMANPLUS,
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
      failureRate: 10,
      adaptedFailures: false,
      depth: 4,
      fanout: 8,
      groupSize: 5,
      concentration: 0,
      random: false,
      seed: '8',
    },
  ]
} else {
  configs = createRunConfigs({
    strategies: [STRATEGIES.STRAWMAN, STRATEGIES.STRAWMANPLUS, STRATEGIES.EAGER, STRATEGIES.ONESHOT],
    depths: [3, 4],
    failures: Array(10)
      .fill(0)
      .map((_, i) => i * 10),
    modelSizes: Array(5)
      .fill(0)
      .map((_, i) => 2 ** (10 + 2 * i)),
    retries: 10,
    fullSpace: false,
    defaultValues: {
      depth: 4,
      failure: 50,
      modelSize: 2 ** 10,
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
