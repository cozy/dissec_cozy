import { execSync } from 'child_process'
import fs from 'fs'
import cloneDeep from 'lodash/cloneDeep'

import NodesManager, { AugmentedMessage } from './manager'
import { Message, MessageType, StopStatus } from './message'
import Node, { NodeRole } from './node'
import TreeNode from './treeNode'

export enum FailurePropagationBlock {
  FullFailurePropagation = 'FFP',
  LocalFailurePropagation = 'LFP',
}

export enum FailureHandlingBlock {
  Replace = 'Replace',
  Drop = 'Drop',
}

export enum StandbyBlock {
  Stop = 'Stop',
  Stay = 'Stay',
  NoResync = '0Resync',
}

export enum SynchronizationBlock {
  FullSynchronization = 'FullSync',
  LeavesSynchronization = 'Leaves',
  NonBlocking = 'NonBlocking',
  None = 'None',
}

export interface BuildingBlocks {
  failurePropagation: FailurePropagationBlock
  failureHandling: FailureHandlingBlock
  standby: StandbyBlock
  synchronization: SynchronizationBlock
}

export interface RunConfig {
  buildingBlocks: BuildingBlocks
  selectivity: number
  maxToAverageRatio: number
  averageLatency: number
  averageBandwidth: number
  averageCryptoTime: number
  averageComputeTime: number
  modelSize: number
  failCheckPeriod: number
  healthCheckPeriod: number
  multicastSize: number
  deadline: number
  failureRate: number
  adaptedFailures: boolean
  backupToAggregatorsRatio: number
  depth: number
  fanout: number
  groupSize: number
  concentration: number
  random: boolean
  seed: string
}

export const STRATEGIES = {
  STRAWMAN: {
    failurePropagation: FailurePropagationBlock.FullFailurePropagation,
    failureHandling: FailureHandlingBlock.Drop,
    standby: StandbyBlock.Stop,
    synchronization: SynchronizationBlock.None,
  },
  STRAWMANPLUS: {
    failurePropagation: FailurePropagationBlock.LocalFailurePropagation,
    failureHandling: FailureHandlingBlock.Drop,
    standby: StandbyBlock.Stop,
    synchronization: SynchronizationBlock.NonBlocking,
  },
  STRAWMANPLUSPLUS: {
    failurePropagation: FailurePropagationBlock.LocalFailurePropagation,
    failureHandling: FailureHandlingBlock.Drop,
    standby: StandbyBlock.Stay,
    synchronization: SynchronizationBlock.NonBlocking,
  },
  EAGER: {
    failurePropagation: FailurePropagationBlock.LocalFailurePropagation,
    failureHandling: FailureHandlingBlock.Replace,
    standby: StandbyBlock.Stay,
    synchronization: SynchronizationBlock.NonBlocking,
  },
  ONESHOT: {
    failurePropagation: FailurePropagationBlock.LocalFailurePropagation,
    failureHandling: FailureHandlingBlock.Drop,
    standby: StandbyBlock.Stop,
    synchronization: SynchronizationBlock.FullSynchronization,
  },
  SAFESLOW: {
    failurePropagation: FailurePropagationBlock.LocalFailurePropagation,
    failureHandling: FailureHandlingBlock.Replace,
    standby: StandbyBlock.Stay,
    synchronization: SynchronizationBlock.FullSynchronization,
  },
  HYBRID_UTIL: {
    failurePropagation: FailurePropagationBlock.LocalFailurePropagation,
    failureHandling: FailureHandlingBlock.Replace,
    standby: StandbyBlock.NoResync,
    synchronization: SynchronizationBlock.NonBlocking,
  },
}

export function defaultConfig(): RunConfig {
  const baseConfig = {
    buildingBlocks: STRATEGIES.EAGER,
    selectivity: 0.1,
    maxToAverageRatio: 10,
    averageLatency: 0.033,
    averageBandwidth: 6000,
    averageCryptoTime: 0.01,
    averageComputeTime: 0.00005, // Time spent working for each kbytes
    modelSize: 1000,
    failCheckPeriod: 100,
    healthCheckPeriod: 3,
    multicastSize: 5,
    deadline: 5 * 10 ** 7,
    failureRate: 20,
    adaptedFailures: true,
    backupToAggregatorsRatio: 0.5,
    depth: 3,
    fanout: 8,
    groupSize: 5,
    concentration: 0,
    random: false,
    seed: `1`,
  }

  return baseConfig
}

export interface RunResult extends RunConfig {
  status: StopStatus
  work: number
  latency: number
  completeness: number
  circulatingAggregateIds: number
  finalInboundBandwidth: number
  finalOutboundBandwidth: number
  observedFailureRate: number
  messages: AugmentedMessage[]
}

export class ExperimentRunner {
  runs: RunConfig[]
  outputPath: string
  checkpoint?: { checkpoint: number; name: string; path: string }
  debug?: boolean = false
  fullExport?: boolean = false
  intermediateExport?: number = 0

  constructor(
    runs: RunConfig[],
    options: {
      debug?: boolean
      fullExport?: boolean
      intermediateExport?: number
      checkpoint?: { checkpoint: number; name: string; path: string }
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
      'strategy',
      'multicastSize',
      'selectivity',
      'deadline',
      'seed',
      'failCheckPeriod',
      'healthCheckPeriod',
      'averageLatency',
      'averageBandwidth',
      'averageCryptoTime',
      'averageComputeTime',
      'maxR',
      'random',
      'concentration',
    ]

    // Shorter names for keys
    const translation: { [k: string]: string } = {
      strategy: 'strat',
      buildingBlocks: 'blocks',
      maxToAverageRatio: 'maxR',
      averageLatency: 'lat',
      averageBandwidth: 'bw',
      averageCryptoTime: 'crypto',
      averageComputeTime: 'comp',
    }

    // Put values for each keys in an array
    runs.forEach(run =>
      Object.entries(run).forEach(([k, v]) => {
        if (skippedKeys.includes(k)) return
        const translatedKey = translation[k] ? translation[k] : k

        if (!uniqueValues[translatedKey]) uniqueValues[translatedKey] = []
        if (values[translatedKey]) values[translatedKey].push(typeof v !== 'object' ? v : Object.values(v).join('.'))
        else values[translatedKey] = [typeof v !== 'object' ? v : Object.values(v).join('.')]
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
    this.outputPath = this.outputPath
      .replaceAll('"', '')
      .replaceAll(',', '_')
      .replaceAll(':', '')
      .replaceAll('{', '')
      .replaceAll('}', '')
  }

  writeResults(outputPath: string, results: RunResult[]) {
    console.log('Writing results at', this.outputPath)
    if (!this.fullExport) {
      // Write each run as a row
      for (let i = 0; i < results.length; i++) {
        const { messages, ...items } = results[i]

        if (i === 0 && ((this.checkpoint && this.checkpoint?.checkpoint === 0) || !this.checkpoint)) {
          // Add columns titles
          fs.writeFileSync(outputPath, Object.keys(items).join(';') + ';name\n')
        }

        fs.writeFileSync(
          outputPath,
          Object.entries(items)
            .map(([k, e]) => {
              if (typeof e === 'number' && k !== 'failureRate') return e.toFixed(2)
              else if (typeof e === 'object') return Object.values(e).join('.')
              else return e
            })
            .join(';')
            .replaceAll('.', ',') +
            `;${Object.values(items.buildingBlocks).join('-')}-m${items.modelSize}-f${items.failureRate}-d${
              items.depth
            }-s${items.seed}\n`,
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

        if (i === 0 && ((this.checkpoint && this.checkpoint?.checkpoint === 0) || !this.checkpoint)) {
          // Add columns titles
          fs.writeFileSync(outputPath, columns.join(';') + ';name\n')
        }

        fs.writeFileSync(
          outputPath,
          messages
            .map(message => {
              const assign: { [k: string]: any } = Object.assign(items, message)
              return (
                columns
                  .map(e => {
                    if (typeof assign[e] === 'number' && e !== 'failureRate') return assign[e].toFixed(2)
                    else if (typeof assign[e] === 'object') return Object.values(assign[e]).join('-')
                    else return assign[e]
                  })
                  .join(';')
                  .replaceAll('.', ',') +
                `;${Object.values(assign.buildingBlocks).join('-')}-m${assign.modelSize}-d${items.depth}-m${
                  assign.failureRate
                }-s${assign.seed}\n`
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
      let result = this.singleRun(this.runs[i])
      let j = 0
      // HACK: Retry to find working simulations
      while (!result) {
        const newConfiguration = cloneDeep(this.runs[i])
        newConfiguration.seed += `-retry${++j}`
        console.log('Retry', newConfiguration.seed)
        result = this.singleRun(newConfiguration)
      }

      results.push(result)

      const averageRunTime = (Date.now() - startTime) / (i + 1)
      const runsLeft = this.runs.length - i
      console.log(
        `Estimated time left: ${(averageRunTime * runsLeft) / 60000} minutes (current ime: ${new Date().toISOString()})`
      )
      console.log()

      if (this.intermediateExport && ++exportCounter >= this.intermediateExport) {
        exportCounter = 0
        // Writing intermediary results
        this.writeResults(this.outputPath, results)

        if (this.checkpoint) {
          this.checkpoint.checkpoint += 1
          fs.writeFileSync(this.checkpoint.path, JSON.stringify(this.checkpoint))
          console.log(`Checkpoint ${i}/${this.runs.length}!`)
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

  singleRun(run: RunConfig): RunResult | undefined {
    // Exclude contributors (nodes at the last level)
    const nodesInTree = run.fanout ** (run.depth - 1) * run.groupSize
    const backupListSize = Math.round(nodesInTree * run.backupToAggregatorsRatio)

    // Create the tree structure
    let { nextId, node: root } = TreeNode.createTree(run, run.depth, 0)

    // Adding the querier group
    const querierGroup = new TreeNode(run.depth + 1)
    querierGroup.children.push(root)
    querierGroup.members = Array(run.groupSize).fill(nextId)
    root.parents = querierGroup.members

    // Initialize the manager and populate nodes
    const manager = NodesManager.createFromTree(root, {
      ...run,
      debug: this.debug,
      fullExport: this.fullExport,
    })
    const n = manager.addNode(querierGroup, querierGroup.members[0])
    n.role = NodeRole.Querier

    // Backup list is included in all protocols to preserve fairness: backups can fail
    // Create a backup list and give it to all the nodes
    const backupListStart = Object.keys(manager.nodes).length
    const backups = []
    // Create as many backup as nodes in the tree
    for (let i = 0; i < backupListSize; i++) {
      const backup = new Node({ manager, id: backupListStart + i, config: manager.config })
      backup.role = NodeRole.Backup
      manager.nodes[backupListStart + i] = backup
      backups.push(backup)
    }

    manager.replacementNodes = backups

    manager.setFailures()

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
          new Message(
            MessageType.RequestContribution,
            0,
            (averageHopsPerBroadcast + 1) * manager.standardLatency(),
            aggregator.members[0],
            child,
            {
              parents: aggregator.members,
            }
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

    manager.initialNodeRoles = manager.countNodesPerRole()

    // Running the simulator the end
    while (manager.messages.length > 0) {
      manager.handleNextMessage()
    }

    if (manager.status === StopStatus.Unfinished) {
      // No messages and not checking health, add a fake message to update
      manager.messages = [
        new Message(MessageType.StopSimulator, manager.globalTime, manager.globalTime, 0, 0, {
          status: StopStatus.ExceededDeadline,
        }),
      ]
      manager.handleNextMessage()
    }

    manager.finalNodeRoles = manager.countNodesPerRole()

    const initialNumberContributors = contributorsNodes.flatMap(e => e.members).length
    const receivedNumberContributors = manager.finalNumberContributors
    const completeness = (100 * receivedNumberContributors) / initialNumberContributors

    console.log(
      `Simulation finished with status ${manager.status} (${completeness}% completeness = ${receivedNumberContributors}/${initialNumberContributors}); time = ${manager.globalTime}`
    )

    const nodes = Object.values(manager.nodes).filter(e => e.role !== NodeRole.Backup)
    const failedNodes = nodes.filter(e => e.deathTime <= manager.globalTime && e.deathTime >= 0)
    console.log(
      `${(failedNodes.length / nodes.length) * 100}% of nodes failed (${failedNodes.length} / ${nodes.length})`
    )
    console.log(
      `${
        (Object.values(manager.nodes).filter(e => e.deathTime <= manager.globalTime && e.deathTime >= 0).length /
          Object.values(manager.nodes).length) *
        100
      }% of nodes failed network-wide`
    )

    if (this.debug) {
      manager.displayAggregateId()
    }

    const oldMessages: AugmentedMessage[] = []
    if (this.fullExport) {
      const oldIds: number[] = []
      for (const m of manager.oldMessages) {
        if (!oldIds.includes(m.id)) {
          oldIds.push(m.id)
          oldMessages.push(m)
        }
      }
    }

    return {
      ...run,
      status: manager.status,
      work: manager.totalWork,
      latency: manager.globalTime,
      completeness,
      circulatingAggregateIds: Object.keys(manager.circulatingAggregateIds).length,
      finalInboundBandwidth: manager.inboundBandwidth,
      finalOutboundBandwidth: manager.outboundBandwidth,
      observedFailureRate: (failedNodes.length / nodes.length) * 100,
      ...manager.statisticsPerRole(),
      messages: oldMessages,
    }
  }
}
