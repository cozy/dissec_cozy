import fs from 'fs'

import NodesManager from './manager'
import { Message, MessageType, StopStatus } from './message'
import Node, { NodeRole } from './node'
import TreeNode from './treeNode'

export enum ProtocolStrategy {
  Pessimistic = 'PESS',
  Optimistic = 'OPTI',
  Eager = 'EAGER',
}

export interface RunConfig {
  strategy: ProtocolStrategy
  selectivity: number
  averageLatency: number
  maxToAverageRatio: number
  averageCryptoTime: number
  averageComputeTime: number
  healthCheckPeriod: number
  multicastSize: number
  deadline: number
  failureRate: number
  depth: number
  fanout: number
  groupSize: number
  seed: string
}

export interface RunResult extends RunConfig {
  status: StopStatus
  observedFailureRate: number
  work: number
  latency: number
  completeness: number
  messages: Message[]
}

export class ExperimentRunner {
  runs: RunConfig[]
  debug?: boolean = false
  fullExport?: boolean = false

  constructor(runs: RunConfig[], options: { debug?: boolean; fullExport?: boolean } = {}) {
    this.runs = runs
    this.debug = options.debug
    this.fullExport = options.fullExport
  }

  writeResults(outputPath: string, results: RunResult[]) {
    // Splitting the array in smaller pieces to prevent running out of memory
    fs.writeFileSync(outputPath, '[') // Default mode is w
    for (let i = 0; i < results.length; i++) {
      const output: { [key: string]: any[] } = {}
      const { messages, ...items } = results[i]

      // Initializing arrays for each stat
      Object.entries(items).forEach(
        ([key, value]) => (output[key] = Array(this.fullExport ? messages.length : 1).fill(value))
      )

      if (this.fullExport) {
        // Only export messages for full exports
        Object.keys(messages[0]).forEach(key => (output[key] = Array(messages.length).fill(0)))
        messages.forEach((message, j) =>
          Object.entries(message).forEach(([key, value]) => {
            // Exclude content because it's not used but takes a lot of space
            if (key === 'content') return
            output[key][j] = value
          })
        )
      }

      fs.writeFileSync(outputPath, JSON.stringify(output), { flag: 'a' })
      if (i !== results.length - 1) {
        fs.writeFileSync(outputPath, ',', { flag: 'a' })
      }
    }
    fs.writeFileSync(outputPath, ']', { flag: 'a' })
  }

  run(outputPath: string) {
    const results: RunResult[] = []
    for (const run of this.runs) {
      console.log(JSON.stringify(run))
      results.push(this.singleRun(run))
      console.log()
      // Writing intermediary results
      this.writeResults(outputPath, results)
    }

    console.log('Success rate:', results.filter(e => e.status === StopStatus.Success).length, '/', results.length)
    console.log(
      'Messages: ',
      results.map(e => e.messages.length).reduce((prev, curr) => prev + curr)
    )

    if (!fs.existsSync(outputPath)) {
      const components = outputPath.split('/')
      fs.mkdirSync(outputPath.replace(components[components.length - 1], ''), {
        recursive: true,
      })
    }

    this.writeResults(outputPath, results)
  }

  singleRun(run: RunConfig): RunResult {
    const nodesInTree = run.fanout ** run.depth * run.groupSize
    const backupListSize = nodesInTree * 1

    // Create the tree structure
    const { nextId, node: root } = TreeNode.createTree(run.depth, run.fanout, run.groupSize, 0)

    // Adding the querier group
    const querierGroup = new TreeNode(nextId, run.depth + 1)
    querierGroup.children.push(root)
    querierGroup.members = Array(run.groupSize).fill(nextId)
    root.parents = querierGroup.members

    const manager = NodesManager.createFromTree(root, {
      ...run,
      debug: this.debug,
    })
    const n = manager.addNode(querierGroup, querierGroup.id)
    n.role = NodeRole.Querier
    // Only the node with the lowest ID sends the message
    manager.transmitMessage(new Message(MessageType.RequestHealthChecks, 0, 0, querierGroup.id, querierGroup.id, {}))

    // Create a backup list and give it to all the nodes
    const backupListStart = Object.keys(manager.nodes).length
    const backups = []
    for (let i = 0; i < backupListSize; i++) {
      const backup = new Node({ id: backupListStart + i, config: manager.config })
      backup.role = NodeRole.Backup
      manager.nodes[backupListStart + i] = backup
      backups.push(backup)
    }
    for (let i = 0; i < backupListStart; i++) {
      manager.nodes[i].backupList = backups.map(e => e.id)
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

      if (run.strategy === ProtocolStrategy.Pessimistic) {
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

          // Timeout is set at the max between the encryption latency for the contributor
          // and the decryption time for the aggregator.
          manager.transmitMessage(
            new Message(
              MessageType.ContributionTimeout,
              0,
              (averageHopsPerBroadcast + 1) * run.averageLatency * run.maxToAverageRatio +
                manager.nodes[member].cryptoLatency() *
                  Math.max(
                    run.groupSize,
                    manager.nodes[member].node?.children.flatMap(e => e.members).length || run.groupSize * run.fanout
                  ) *
                  3,
              member,
              member,
              {}
            )
          )
        }
      } else if (run.strategy === ProtocolStrategy.Optimistic || run.strategy === ProtocolStrategy.Eager) {
        // Contributors respond with a ping to the first member
        manager.transmitMessage(
          new Message(
            MessageType.PingTimeout,
            0,
            (averageHopsPerBroadcast + 1) * run.averageLatency * run.maxToAverageRatio,
            aggregator.members[0],
            aggregator.members[0],
            {}
          )
        )

        // Setting contribution collection timeouts on the leaves aggregators
        // The first member times out first to inform its members
        for (const member of aggregator.members) {
          manager.transmitMessage(
            new Message(
              MessageType.ContributionTimeout,
              0,
              (averageHopsPerBroadcast + aggregator.members.indexOf(member) === 0 ? 1 : 2) *
                run.averageLatency *
                run.maxToAverageRatio +
                manager.nodes[member].cryptoLatency() *
                  Math.max(
                    run.groupSize,
                    manager.nodes[member].node?.children.flatMap(e => e.members).length || run.groupSize * run.fanout
                  ) *
                  3,
              member,
              member,
              {}
            )
          )
        }
      }
    }

    // Set contributors role
    const contributors = root.selectNodesByDepth(run.depth)
    for (const contributorGroup of contributors) {
      for (const contributor of contributorGroup.members) {
        manager.nodes[contributor].role = NodeRole.Contributor
      }
    }

    // Upper layers periodically send health checks to their children
    for (let i = 0; i < run.depth - 1; i++) {
      const nodes = root.selectNodesByDepth(i)
      for (const node of nodes) {
        for (const member of node.members) {
          manager.transmitMessage(new Message(MessageType.RequestHealthChecks, 0, 0, member, member, {}))
        }
      }
    }

    while (manager.messages.length > 0) {
      manager.handleNextMessage()
    }

    const completeness =
      ((manager.oldMessages.find(e => e.type === MessageType.StopSimulator)?.content.contributors?.length || 0) /
        run.groupSize /
        run.fanout ** run.depth) *
      100

    console.log(`Simulation finished with status ${manager.status} (${completeness}% completeness)`)
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

    const oldMessages: Message[] = []
    const oldIds: number[] = []
    manager.oldMessages.forEach(m => {
      if (!oldIds.includes(m.id)) {
        oldIds.push(m.id)
        oldMessages.push(m)
      }
    })
    return {
      ...run,
      status: manager.status,
      work: oldMessages.map(e => e.work).reduce((previous, current) => previous + current),
      latency: Math.max(...oldMessages.map(e => e.receptionTime)),
      completeness,
      observedFailureRate:
        Object.values(manager.nodes).filter(e => !e.alive).length / Object.values(manager.nodes).length,
      messages: this.fullExport ? oldMessages : [],
    }
  }
}
