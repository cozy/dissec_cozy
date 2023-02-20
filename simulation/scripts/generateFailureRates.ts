import { defaultConfig } from '../src/experimentRunner'
import NodesManager from '../src/manager'

for (const failure of [0, 3, 50, 70, 95]) {
  const def = defaultConfig()
  const config = Object.assign(def, { failureRate: failure, adaptedFailures: true })
  const manager = new NodesManager(config)
  console.log(failure === 0 ? 0 : manager.baseProtocolLatency() * (100 - def.failureRate))
}
