import { BuildingBlocks, defaultConfig } from './experimentRunner'

export function createRunConfigs({
  strategies,
  depths,
  failures,
  modelSizes,
  backupsToAggregatorsRatios,
  retries,
  fullSpace,
  defaultValues,
}: {
  strategies: BuildingBlocks[]
  depths: number[]
  failures: number[]
  modelSizes: number[]
  backupsToAggregatorsRatios: number[]
  retries: number
  fullSpace: boolean
  defaultValues?: {
    depth: number
    failure: number
    modelSize: number
    backupsToAggregatorsRatio: number
  }
}) {
  let configs = []
  const baseConfig = defaultConfig()

  if (fullSpace) {
    for (const buildingBlocks of strategies) {
      for (const depth of depths) {
        for (const failure of failures) {
          for (const modelSize of modelSizes) {
            for (const backupsToAggregatorsRatio of backupsToAggregatorsRatios) {
              for (let retry = 0; retry < retries; retry++) {
                configs.push(
                  Object.assign({}, baseConfig, {
                    buildingBlocks,
                    failureRate: failure,
                    modelSize,
                    depth,
                    backupsToAggregatorsRatio,
                    seed: `${retry}`,
                  })
                )
              }
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
              backupsToAggregatorsRatio: defaultValues.backupsToAggregatorsRatio,
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
              backupsToAggregatorsRatio: defaultValues.backupsToAggregatorsRatio,
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
              backupsToAggregatorsRatio: defaultValues.backupsToAggregatorsRatio,
              depth: defaultValues.depth,
              seed: `${retry}`,
            })
          )
        }

        for (const backupsToAggregatorsRatio of backupsToAggregatorsRatios) {
          configs.push(
            Object.assign({}, baseConfig, {
              buildingBlocks,
              failureRate: defaultValues.failure,
              modelSize: defaultValues.modelSize,
              backupsToAggregatorsRatio,
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
