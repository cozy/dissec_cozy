import { BuildingBlocks, defaultConfig } from './experimentRunner'

export function createRunConfigs({
  strategies,
  depths,
  failures,
  groupSizes,
  modelSizes,
  retries,
  fullSpace,
  seedPrefix = '',
  defaultValues,
}: {
  strategies: BuildingBlocks[]
  depths: number[]
  failures: number[]
  modelSizes: number[]
  groupSizes: number[]
  retries: number
  fullSpace: boolean
  seedPrefix?: string
  defaultValues?: {
    depth: number
    failure: number
    modelSize: number
    groupSize: number
  }
}) {
  let configs = []
  const baseConfig = defaultConfig()

  if (fullSpace) {
    for (const depth of depths) {
      for (const failure of failures) {
        for (const groupSize of groupSizes) {
          for (const modelSize of modelSizes) {
            for (let retry = 0; retry < retries; retry++) {
              for (const buildingBlocks of strategies) {
                configs.push(
                  Object.assign({}, baseConfig, {
                    buildingBlocks,
                    failureRate: failure,
                    modelSize,
                    groupSize,
                    depth,
                    seed: `${seedPrefix}${retry}`,
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
              groupSize: defaultValues.groupSize,
              modelSize: defaultValues.modelSize,
              depth: depth,
              seed: `${seedPrefix}${retry}`,
            })
          )
        }

        for (const failure of failures) {
          configs.push(
            Object.assign({}, baseConfig, {
              buildingBlocks,
              failureRate: failure,
              groupSize: defaultValues.groupSize,
              modelSize: defaultValues.modelSize,
              depth: defaultValues.depth,
              seed: `${seedPrefix}${retry}`,
            })
          )
        }

        for (const groupSize of groupSizes) {
          configs.push(
            Object.assign({}, baseConfig, {
              buildingBlocks,
              failureRate: defaultValues.failure,
              groupSize,
              modelSize: defaultValues.modelSize,
              depth: defaultValues.depth,
              seed: `${seedPrefix}${retry}`,
            })
          )
        }

        for (const modelSize of modelSizes) {
          configs.push(
            Object.assign({}, baseConfig, {
              buildingBlocks,
              failureRate: defaultValues.failure,
              groupSize: defaultValues.groupSize,
              modelSize: modelSize,
              depth: defaultValues.depth,
              seed: `${seedPrefix}${retry}`,
            })
          )
        }
      }
    }
  }

  return configs
}
