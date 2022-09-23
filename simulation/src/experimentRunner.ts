import fs from 'fs'
import { execSync } from 'child_process'

import NodesManager, { AugmentedMessage } from './manager'
import { Message, MessageType, StopStatus } from './message'
import Node, { NodeRole } from './node'
import TreeNode from './treeNode'

export enum ProtocolStrategy {
  Pessimistic = 'PESS',
  Optimistic = 'OPTI',
  Eager = 'EAGER',
  Strawman = 'STRAW',
}

export interface RunConfig {
  strategy: ProtocolStrategy
  selectivity: number
  maxToAverageRatio: number
  averageLatency: number
  averageCryptoTime: number
  averageComputeTime: number
  failCheckPeriod: number
  healthCheckPeriod: number
  multicastSize: number
  deadline: number
  failureRate: number
  depth: number
  fanout: number
  groupSize: number
  concentration: number
  random: boolean
  seed: string
}

export interface RunResult extends RunConfig {
  status: StopStatus
  work: number
  latency: number
  completeness: number
  circulatingAggregateIds: number
  finalUsedBandwidth: number
  observedFailureRate: number
  messages: AugmentedMessage[]
}

export class ExperimentRunner {
  runs: RunConfig[]
  outputPath: string
  checkpoint?: { checkpoint: number; name: string }
  debug?: boolean = false
  fullExport?: boolean = false
  intermediateExport?: number = 0

  constructor(
    runs: RunConfig[],
    options: {
      debug?: boolean
      fullExport?: boolean
      intermediateExport?: number
      checkpoint?: { checkpoint: number; name: string }
    } = {
      intermediateExport: 0,
    }
  ) {
    this.runs = runs
    this.checkpoint = options.checkpoint
    this.debug = options.debug
    this.fullExport = options.fullExport
    this.intermediateExport = options.intermediateExport

    // Compute output path based on run configs
    const values: { [k: string]: any[] } = {}
    const uniqueValues: { [k: string]: any[] } = {}
    const labels: { [k: string]: string } = {}

    // These keys will not be in the name
    const skippedKeys = [
      'multicastSize',
      'selectivity',
      'deadline',
      'seed',
      'failCheckPeriod',
      'healthCheckPeriod',
      'averageLatency',
      'averageCryptoTime',
      'averageComputeTime',
      'maxR',
    ]

    // Shorter names for keys
    const translation: { [k: string]: string } = {
      strategy: 'strat',
      maxToAverageRatio: 'maxR',
      averageLatency: 'lat',
      averageCryptoTime: 'crypto',
      averageComputeTime: 'compute',
    }

    // Put values for each keys in an array
    runs.forEach(run =>
      Object.entries(run).forEach(([k, v]) => {
        if (skippedKeys.includes(k)) return
        const translatedKey = translation[k] ? translation[k] : k

        if (!uniqueValues[translatedKey]) uniqueValues[translatedKey] = []
        if (values[translatedKey]) values[translatedKey].push(v)
        else values[translatedKey] = [v]
      })
    )

    // Keep unique values and range
    for (const [k, arr] of Object.entries(values)) {
      for (const v of arr) {
        if (!uniqueValues[k].includes(v)) {
          uniqueValues[k].push(v)
        }
      }
      uniqueValues[k].sort()
      labels[k] =
        uniqueValues[k].length > 1
          ? `${uniqueValues[k][0]}-${uniqueValues[k].length}-${uniqueValues[k][uniqueValues[k].length - 1]}`
          : `${uniqueValues[k][0]}`
    }

    new Date().toISOString().split('T')[0]
    if (this.checkpoint) {
      this.outputPath = this.checkpoint.name + '.csv'
    } else {
      this.outputPath =
        `./outputs/${new Date().toISOString()}_${execSync('git rev-parse HEAD').toString().trim()}_run${runs.length}_${
          this.fullExport ? 'full_' : ''
        }` +
        JSON.stringify(labels)
          .replaceAll('"', '')
          .replaceAll(',', '_')
          .replaceAll(':', '')
          .replaceAll('{', '')
          .replaceAll('}', '') +
        '.csv'
    }
  }

  writeResults(outputPath: string, results: RunResult[]) {
    if (!this.fullExport) {
      // Write each run as a row
      for (let i = 0; i < results.length; i++) {
        const { messages, ...items } = results[i]

        if (i === 0 && this.checkpoint?.checkpoint === 0) {
          // Add columns titles
          fs.writeFileSync(outputPath, Object.keys(items).join(';') + '\n')
        }

        fs.writeFileSync(
          outputPath,
          Object.entries(items)
            .map(([k, e]) => (typeof e === 'number' && k !== 'failureRate' ? e.toFixed(2) : e))
            .join(';')
            .replaceAll('.', ',') + '\n',
          { flag: 'a' }
        )
      }
    } else {
      const { messages: _messages, ...items } = results[0]
      const { content: _content, id: _id, ...restMessage } = _messages[0]
      const columns = Object.keys(Object.assign(items, restMessage))

      // Write each message as a row
      for (let i = 0; i < results.length; i++) {
        const { messages, ...items } = results[i]

        if (i === 0 && this.checkpoint?.checkpoint === 0) {
          // Add columns titles
          fs.writeFileSync(outputPath, columns.join(';') + '\n')
        }

        fs.writeFileSync(
          outputPath,
          messages
            .map(message => {
              const assign: { [k: string]: any } = Object.assign(items, message)
              return (
                columns
                  .map(e => (typeof assign[e] === 'number' && e !== 'failureRate' ? assign[e].toFixed(2) : assign[e]))
                  .join(';')
                  .replaceAll('.', ',') + '\n'
              )
            })
            .join(''),
          { flag: 'a' }
        )
      }
    }
  }

  run() {
    const results: RunResult[] = []
    const startTime = Date.now()

    if (!fs.existsSync(this.outputPath)) {
      const components = this.outputPath.split('/')
      fs.mkdirSync(this.outputPath.replace(components[components.length - 1], ''), {
        recursive: true,
      })
    }

    let exportCounter = 0
    for (let i = 0; i < this.runs.length; i++) {
      console.log(JSON.stringify(this.runs[i]))
      results.push(this.singleRun(this.runs[i]))

      const averageRunTime = (Date.now() - startTime) / (i + 1)
      const runsLeft = this.runs.length - i
      console.log(`Estimated time left: ${(averageRunTime * runsLeft) / 60000} minutes`)
      console.log()

      if (this.intermediateExport && ++exportCounter >= this.intermediateExport) {
        exportCounter = 0
        // Writing intermediary results
        this.writeResults(this.outputPath, results)

        if (this.checkpoint) {
          this.checkpoint.checkpoint += 1
          fs.writeFileSync('./checkpoint.json', JSON.stringify(this.checkpoint))
          console.log('Checkpoint!')
        }
      }
    }

    console.log('Success rate:', results.filter(e => e.status === StopStatus.Success).length, '/', results.length)
    console.log(
      'Messages: ',
      results.map(e => e.messages.length).reduce((prev, curr) => prev + curr)
    )

    this.writeResults(this.outputPath, results)
    console.log(`Total simulation time: ${(Date.now() - startTime) / 60000} minutes`)
  }

  singleRun(run: RunConfig): RunResult {
    // Exclude contributors (nodes at the last level)
    const nodesInTree = run.fanout ** (run.depth - 1) * run.groupSize
    const backupListSize = nodesInTree * 1

    // Create the tree structure
    let { nextId, node: root } = TreeNode.createTree(run, run.depth, 0)

    // Adding the querier group
    const querierGroup = new TreeNode(nextId, run.depth + 1)
    querierGroup.children.push(root)
    querierGroup.members = Array(run.groupSize).fill(nextId)
    root.parents = querierGroup.members

    // Initialize the manager and populate nodes
    const manager = NodesManager.createFromTree(root, {
      ...run,
      debug: this.debug,
      fullExport: this.fullExport,
    })
    const n = manager.addNode(querierGroup, querierGroup.id)
    n.role = NodeRole.Querier

    // Backup list is included in all protocols to preserve fairness: backups can fail
    // Create a backup list and give it to all the nodes
    const backupListStart = Object.keys(manager.nodes).length
    const backups = []
    // Create as many backup as nodes in the tree
    for (let i = 0; i < backupListSize; i++) {
      const backup = new Node({ id: backupListStart + i, config: manager.config })
      backup.role = NodeRole.Backup
      manager.nodes[backupListStart + i] = backup
      backups.push(backup)
    }

    // Strawman does no health verifications
    if (run.strategy !== ProtocolStrategy.Strawman) {
      // Only the node with the lowest ID sends the message
      manager.transmitMessage(new Message(MessageType.RequestHealthChecks, 0, 0, querierGroup.id, querierGroup.id, {}))

      // Eager does not use a backup list
      if (run.strategy !== ProtocolStrategy.Eager) {
        for (let i = 0; i < backupListStart; i++) {
          if (manager.nodes[i]) {
            manager.nodes[i].backupList = backups.map(e => e.id)
          }
        }
      }
    }

    // All leaves aggregator request data from contributors

    // The number of hops needed on average to reach all the node in a zone
    // const numberContributors = run.groupSize * run.fanout ** run.depth // TODO: Not accurate
    // const totalNumberOfNodes = numberContributors / run.selectivity
    // const nodesPerZone = totalNumberOfNodes / run.fanout ** run.depth
    // // Nodes broadcast to all the nodes they know in their finger table
    // const averageHopsPerBroadcast = Math.log2(Math.log2(nodesPerZone))
    // TODO: Compute this value depending on the total number of nodes in the network
    const averageHopsPerBroadcast = 1

    const leavesAggregators = root.selectNodesByDepth(run.depth - 1)
    for (const aggregator of leavesAggregators) {
      for (const member of aggregator.members) {
        manager.nodes[member].role = NodeRole.LeafAggregator
      }
      // Requesting contributions
      for (const child of aggregator.children.flatMap(e => e.members)) {
        // Only the node with the lowest ID sends the message
        manager.transmitMessage(
          new Message(MessageType.RequestContribution, 0, 0, aggregator.id, child, {
            parents: aggregator.members,
          })
        )
      }

      // Setting contribution collection timeouts on the leaves aggregators
      for (const member of aggregator.members) {
        // Contributors respond with a ping and then the contribution, await both
        manager.transmitMessage(
          new Message(
            MessageType.PingTimeout,
            0,
            (averageHopsPerBroadcast + 1) * run.averageLatency * run.maxToAverageRatio,
            member,
            member,
            {}
          )
        )
      }
    }

    // Set contributors role
    const contributorsNodes = root.selectNodesByDepth(run.depth)
    for (const contributorGroup of contributorsNodes) {
      for (const contributor of contributorGroup.members) {
        manager.nodes[contributor].role = NodeRole.Contributor
      }
    }

    if (run.strategy !== ProtocolStrategy.Strawman) {
      // Upper layers periodically send health checks to their children
      for (let i = 0; i < run.depth - 1; i++) {
        const nodes = root.selectNodesByDepth(i)
        for (const node of nodes) {
          for (const member of node.members) {
            manager.transmitMessage(new Message(MessageType.RequestHealthChecks, 0, 0, member, member, {}))
          }
        }
      }
    }

    manager.initialNodeRoles = manager.countNodesPerRole()

    // Running the simulator the end
    while (manager.messages.length > 0) {
      manager.handleNextMessage()
    }

    if (manager.status === StopStatus.Unfinished) {
      // No messages and not checking health, add a fake message to update
      manager.messages = [new Message(MessageType.StopSimulator, 0, -1, 0, 0, { status: StopStatus.ExceededDeadline })]
      manager.handleNextMessage()
    }

    manager.finalNodeRoles = manager.countNodesPerRole()

    const initialNumberContributors = contributorsNodes.flatMap(e => e.members).length
    const receivedNumberContributors = manager.finalNumberContributors
    const completeness = (100 * receivedNumberContributors) / initialNumberContributors

    console.log(
      `Simulation finished with status ${manager.status} (${completeness}% completeness); time = ${manager.globalTime}`
    )
    console.log(
      `${
        (Object.values(manager.nodes).filter(e => !e.alive).length / Object.values(manager.nodes).length) * 100
      }% of nodes failed (${Object.values(manager.nodes).filter(e => !e.alive).length} / ${
        Object.values(manager.nodes).length
      })`
    )

    if (this.debug) {
      manager.displayAggregateId()
    }

    const oldMessages: AugmentedMessage[] = []
    if (this.fullExport) {
      const oldIds: number[] = []
      manager.oldMessages.forEach(m => {
        if (!oldIds.includes(m.id)) {
          oldIds.push(m.id)
          oldMessages.push(m)
        }
      })
    }

    return {
      ...run,
      status: manager.status,
      work: manager.totalWork,
      latency: manager.globalTime,
      completeness,
      circulatingAggregateIds: Object.keys(manager.circulatingAggregateIds).length,
      finalUsedBandwidth: manager.usedBandwidth,
      observedFailureRate:
        (Object.values(manager.nodes).filter(e => !e.alive).length / Object.values(manager.nodes).length) * 100,
      ...manager.statisticsPerRole(),
      messages: oldMessages,
    }
  }
}
