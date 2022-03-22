import { ExperimentRunner } from './experimentRunner'

const configs = Array(2).fill(0).map((_, i) => ({ depth: 3, fanout: 4, groupSize: 3, seed: i.toString() }))
const runner = new ExperimentRunner(configs)

runner.run("./outputs/raw.json")
