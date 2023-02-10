import { BuildingBlocks, defaultConfig } from './experimentRunner'

export function createRunConfigs({
  strategies,
  depths,
  failures,
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
  retries: number
  fullSpace: boolean
  seedPrefix?: string
  defaultValues?: {
    depth: number
    failure: number
    modelSize: number
  }
}) {
  let configs = []
  const baseConfig = defaultConfig()

  if (fullSpace) {
    for (const depth of depths) {
      for (const failure of failures) {
        for (const modelSize of modelSizes) {
          for (let retry = 0; retry < retries; retry++) {
            for (const buildingBlocks of strategies) {
              configs.push(
                Object.assign({}, baseConfig, {
                  buildingBlocks,
                  failureRate: failure,
                  modelSize,
                  depth,
                  seed: `${seedPrefix}${retry}`,
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
              seed: `${seedPrefix}${retry}`,
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
              seed: `${seedPrefix}${retry}`,
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
              seed: `${seedPrefix}${retry}`,
            })
          )
        }
      }
    }
  }

  return configs
}
