import config from '../dissec.config.json'
import { ExperimentRunner, RunConfig } from './experimentRunner'

let configs: RunConfig[] = []
const debug = false
if (debug) {
  configs = [{
    averageLatency: 100,
    maxLatency: 1000,
    averageCrypto: 100,
    averageCompute: 100, healthCheckPeriod: 3000, multicastSize: 5,
    deadline: 100 * 1000, "failureRate": 0.0004, "depth": 3, "fanout": 4, "groupSize": 3, "seed": "1-2"
  }]
} else {
  configs = Array(11)
    .fill(0)
    .flatMap((_, j) => Array(10).fill(0)
      .map((_, i) => ({
        averageLatency: 100,
        maxLatency: 800,
        averageCrypto: 100,
        averageCompute: 100,
        healthCheckPeriod: 2400,
        multicastSize: 5,
        deadline: 100 * 1000,
        failureRate: 0.0002 * j,
        depth: 3,
        fanout: 4,
        groupSize: 3,
        seed: `${i}-${j}`
      })))
}

const runner = new ExperimentRunner(configs, { debug })
runner.run(config.dataPath)
