import config from '../dissec.config.json'
import { ExperimentRunner, RunConfig } from './experimentRunner'

let configs: RunConfig[] = []
const debug = true
if (debug) {
  configs = [
    {
      averageLatency: 100,
      maxToAverageRatio: 10,
      averageCryptoTime: 100,
      averageComputeTime: 100,
      healthCheckPeriod: 3,
      multicastSize: 5,
      deadline: 100000,
      failureRate: 0.0004,
      depth: 3,
      fanout: 4,
      groupSize: 3,
      seed: '4-7'
    }
  ]
} else {
  configs = Array(10)
    .fill(0)
    .flatMap((_, failure) =>
      Array(10)
        .fill(0)
        .map((_, retries) => ({
          averageLatency: 100,
          maxToAverageRatio: 10,
          averageCryptoTime: 100,
          averageComputeTime: 100,
          healthCheckPeriod: 3,
          multicastSize: 5,
          deadline: 100 * 1000,
          failureRate: 0.0001 * failure,
          depth: 3,
          fanout: 4,
          groupSize: 3,
          seed: `${failure}-${retries}`
        }))
    )
}

const runner = new ExperimentRunner(configs, { debug })
runner.run(config.dataPath)
