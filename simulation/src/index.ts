import config from '../dissec.config.json'
import { ExperimentRunner, RunConfig } from './experimentRunner'

let configs: RunConfig[] = []
const debug = false
if (debug) {
  configs = [{ "failureRate": 0.0045000000000000005, "depth": 3, "fanout": 4, "groupSize": 3, "seed": "3-9" }]
} else {
  configs = Array(11)
    .fill(0)
    .flatMap((_, j) => Array(10).fill(0)
      .map((_, i) => ({ failureRate: 0.0005 * j, depth: 3, fanout: 4, groupSize: 3, seed: `${i}-${j}` })))
}

const runner = new ExperimentRunner(configs, { debug })
runner.run(config.dataPath)
