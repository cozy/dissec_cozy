import rayleigh from '@stdlib/random-base-rayleigh'
import cloneDeep from 'lodash/cloneDeep'

import { RunConfig } from './experimentRunner'
import { isSystemMessage, Message, MessageType, StopStatus } from './message'
import { handleFailing, handleStopSimulator } from './messageHandlers/manager'
import Node, { NodeRole } from './node'
import { Generator, xmur3 } from './random'
import TreeNode from './treeNode'

export interface ManagerArguments extends RunConfig {
  debug?: boolean
  fullExport?: boolean
}

export interface AugmentedMessage extends Omit<Message, 'log'> {
  currentlyCirculatingVersions: number
  bandwidth: number
}

export class NodesManager {
  debug?: boolean
  root: TreeNode
  nodes: { [id: number]: Node } = {}
  replacementNodes: Node[] = []
  querier: number = 0
  messages: Message[] = []
  oldMessages: AugmentedMessage[] = []
  messageCounter: number = 0
  globalTime: number = 0
  config: ManagerArguments
  multicastSize: number
  failureRate: number
  lastFailureUpdate: number = 0
  nextStepFailures: number = 0
  status: StopStatus
  generator: () => number
  rayleigh = rayleigh.factory(1, { seed: 1 })
  // Statistics
  initialNodeRoles: { [role: string]: number } = {}
  finalNodeRoles: { [role: string]: number } = {}
  messagesPerRole: { [role: string]: number } = {}
  workPerRole: { [role: string]: number } = {}
  failuresPerRole: { [role: string]: number } = {}
  bandwidthPerRole: { [role: string]: number } = {}
  circulatingAggregateIds: { [id: string]: boolean } = {}
  usedBandwidth: number = 0
  totalWork = 0
  finalNumberContributors = 0

  handleStopSimulator = handleStopSimulator
  handleFailing = handleFailing

  constructor(options: ManagerArguments) {
    this.debug = options.debug
    this.config = options
    this.multicastSize = options.multicastSize
    this.failureRate = options.failureRate
    this.status = StopStatus.Unfinished
    this.generator = Generator.get(options.seed, true)

    // Sigma such that the median is the desired latency
    const sigma = options.averageLatency / Math.sqrt(Math.PI / 2)
    this.rayleigh = rayleigh.factory(sigma, { seed: xmur3(options.seed)() })

    // Initialize stats
    Object.values(NodeRole).forEach(e => {
      this.initialNodeRoles[e] = 0
      this.finalNodeRoles[e] = 0
      this.workPerRole[e] = 0
      this.failuresPerRole[e] = 0
      this.messagesPerRole[e] = 0
      this.bandwidthPerRole[e] = 0
    })
  }

  static createFromTree(root: TreeNode, options: ManagerArguments): NodesManager {
    const manager = new NodesManager(options)
    manager.root = root

    let i = root.members[0]
    let node = root.findGroup(i)
    while (node) {
      const n = manager.addNode(node)
      n.role = NodeRole.Aggregator
      i += 1
      node = root.findGroup(i)
    }

    return manager
  }

  countNodesPerRole() {
    const res: { [key: string]: number } = {}
    for (const node of Object.values(this.nodes)) {
      if (!res[node.role]) res[node.role] = 1
      else res[node.role] += 1
    }
    return res
  }

  statisticsPerRole() {
    const res: { [key: string]: number } = {}
    for (const r of Object.values(NodeRole)) {
      res[`work_${r}`] = this.workPerRole[r]
      res[`failures_${r}`] = this.failuresPerRole[r]
      res[`messages_${r}`] = this.messagesPerRole[r]
      res[`initial_nodes_${r}`] = this.initialNodeRoles[r]
      res[`final_nodes_${r}`] = this.finalNodeRoles[r]
      res[`bandwidth_${r}`] = this.bandwidthPerRole[r]
    }
    return res
  }

  addNode(node: TreeNode, querier?: number): Node {
    if (querier) this.querier = querier
    const id = Object.keys(this.nodes).length
    this.nodes[id] = new Node({ manager: this, node, id, config: this.config })
    return this.nodes[id]
  }

  setFailures() {
    const contributorsWork = 2 * this.config.averageComputeTime * this.config.modelSize * this.config.groupSize
    const contributorsTransmission =
      this.config.averageLatency + (this.config.groupSize * this.config.modelSize) / this.config.averageBandwidth
    const aggregatorsWork = this.config.averageComputeTime * this.config.modelSize
    const aggregatorsTransmission =
      this.config.averageLatency + (this.config.groupSize * this.config.modelSize) / this.config.averageBandwidth
    const querierWork = aggregatorsWork * this.config.groupSize
    const baseProtocolLatency =
      contributorsWork +
      contributorsTransmission +
      this.config.depth * (this.config.fanout * aggregatorsWork + aggregatorsTransmission) +
      querierWork

    if (this.failureRate > 0) {
      for (const node of Object.values(this.nodes)) {
        if (node.role !== NodeRole.Querier) {
          // Exponential law
          // node.deathTime = -this.failureRate * Math.log(1 - this.generator())

          // Uniform distribution over a window
          node.deathTime = baseProtocolLatency * (100 - this.failureRate) * this.generator()
          this.insertMessage(new Message(MessageType.Failing, node.deathTime, node.deathTime, node.id, node.id, {}))
        }
      }
    }
  }

  transmitMessage(unsentMessage: Message) {
    // Messages wtihout arrival date are added a standard latency
    if (unsentMessage.receptionTime === 0)
      unsentMessage.receptionTime = unsentMessage.emissionTime + this.standardLatency()

    if (
      this.nodes[unsentMessage.emitterId].deathTime < 0 ||
      this.nodes[unsentMessage.emitterId].deathTime > unsentMessage.emissionTime
    ) {
      this.insertMessage(cloneDeep(unsentMessage))
      this.messageCounter++
    }
  }

  handleNextMessage() {
    const message = this.messages.pop()
    if (!message) return
    const alive =
      this.nodes[message.receiverId].deathTime < 0 || this.nodes[message.receiverId].deathTime > message.receptionTime

    // Advance simulation time
    this.globalTime = message.receptionTime

    if (isSystemMessage(message.type)) {
      // Treat system messages first
      if (this.config.fullExport) {
        // Save messages for exporting
        this.oldMessages.push({
          ...message,
          currentlyCirculatingVersions: Object.keys(this.circulatingAggregateIds).length,
          bandwidth: this.usedBandwidth,
          ...this.statisticsPerRole(),
        })
      }

      switch (message.type) {
        case MessageType.StopSimulator:
          this.handleStopSimulator(message)
          break
        case MessageType.Failing:
          this.handleFailing(message)
          break
        default:
          throw new Error('Unimplemented system message')
      }
    } else if (message.receptionTime > this.config.deadline) {
      this.messages = [
        new Message(MessageType.StopSimulator, this.globalTime, this.globalTime, 0, 0, {
          status: StopStatus.ExceededDeadline,
        }),
      ]
    } else if (alive) {
      this.oldMessages.findIndex
      // Receiving a message creates new ones
      const resultingMessages = this.nodes[message.receiverId]
        .receiveMessage(message)
        ?.map(e => {
          // Add latency now to prepare sorting
          if (e.receptionTime === 0) e.receptionTime = e.emissionTime + this.standardLatency()
          return e
        })
        .sort((a, b) => (this.AIsBeforeB(a, b) ? 1 : 0))

      if (!resultingMessages) {
        // The message bounced because the node was busy
        this.insertMessage(message)
      } else {
        // Save stats for exporting
        this.totalWork += message.work
        this.workPerRole[this.nodes[message.receiverId].role] += message.work
        if (message.emitterId !== message.receiverId) {
          this.messagesPerRole[this.nodes[message.receiverId].role] += 1
        }
        if (message.type === MessageType.FinishSendingAggregate) {
          this.circulatingAggregateIds[message.content.aggregate!.id] = true
        }
        if (message.type === MessageType.FinishSendingAggregate || message.type === MessageType.FinishContribution) {
          this.usedBandwidth += this.config.modelSize
          this.bandwidthPerRole[this.nodes[message.emitterId].role] += this.config.modelSize
        }

        if (this.config.fullExport) {
          // Save messages for exporting
          this.oldMessages.push({
            ...message,
            currentlyCirculatingVersions: Object.keys(this.circulatingAggregateIds).length,
            bandwidth: this.usedBandwidth,
            ...this.statisticsPerRole(),
          })
        }

        for (const msg of resultingMessages) {
          this.transmitMessage(msg)
        }
      }
    }
  }

  fullFailurePropagation(node: Node, addTimeout: boolean = false) {
    // TODO: Count incurred comms
    const timeout = 2 * this.config.averageLatency * this.config.maxToAverageRatio
    const propagationLatency = (2 * this.config.depth - node.node!.depth) * this.config.averageLatency

    this.insertMessage(
      new Message(
        MessageType.StopSimulator,
        this.globalTime,
        this.globalTime + propagationLatency + (addTimeout ? timeout : 0),
        node.id,
        node.id,
        {
          status: StopStatus.FullFailurePropagation,
          failedNode: node.id,
        }
      )
    )
    // Set all nodes as dead
    Object.values(this.nodes).forEach(node => {
      if (!node.propagatedFailure) {
        node.propagatedFailure = true
        node.deathTime = this.globalTime + propagationLatency
      }
    })
  }

  /**
   * Stops all nodes below the target node, including the target.
   *
   * @param node The node below which the tree is cut
   */
  localeFailurePropagation(node: Node, addTimeout: boolean = false) {
    // TODO: Count incurred comms
    const timeout = 2 * this.config.averageLatency * this.config.maxToAverageRatio
    const propagationLatency = (1 + node.node!.depth) * this.config.averageLatency

    // Set nodes as dead
    const killSubtree = (node: TreeNode) => {
      node.members.forEach(n => {
        if (n === 4017) {
          console.log('weird')
        }
        if (!this.nodes[n].propagatedFailure) {
          this.nodes[n].propagatedFailure = true
          this.nodes[n].deathTime = this.globalTime + propagationLatency + (addTimeout ? timeout : 0)
        }
      })
      node.children.forEach(n => killSubtree(n))
    }
    killSubtree(node.node!)

    // Notify parent
    const position = node.node!.members.indexOf(node.id)
    for (const parent of node.node!.parents) {
      this.insertMessage(
        new Message(
          MessageType.HandleFailure,
          node.localTime,
          node.localTime + this.standardLatency() + (addTimeout ? timeout : 0),
          node.node!.parents[position], // The parent of the target node contacts its members
          parent,
          {
            failedNode: node.id,
            targetGroup: node.node,
          }
        )
      )
    }
  }

  displayAggregateId() {
    const querier = Object.values(this.nodes).filter(e => e.role === NodeRole.Querier)[0]

    const log = (node: Node) => {
      if ((node.node?.children.length || 0) > 0) {
        console.log(
          `Node #${node.id} (members=${node.node!.members}) ID=[${node.node!.members.map(
            e => this.nodes[e].lastSentAggregateId
          )}]`
        )
      }
      for (const child of node.node!.children) {
        console.group()
        log(this.nodes[child.members[0]])
      }
      console.groupEnd()
    }

    log(querier)
  }

  standardLatency(): number {
    if (this.config.random) {
      // TODO: Model latency
      // return Math.max(0, Math.min((this.config.averageLatency * this.config.maxToAverageRatio) / 3, this.rayleigh()))
      return this.config.averageLatency
    } else {
      return this.config.averageLatency
    }
  }

  private AIsBeforeB(a: Message, b: Message): boolean {
    // Use priorities to order message arriving at the same time
    if (b.receptionTime === a.receptionTime) {
      const priorityBonus = (type: MessageType) => {
        switch (type) {
          case MessageType.NotifyGroupTimeout:
            return 1000
          case MessageType.Failing:
            return 900
          case MessageType.NotifyGroup:
            return 800
          case MessageType.GiveUpChild:
            return 800
          case MessageType.ConfirmContributors:
            return 800
          case MessageType.SendChildren:
            return 800
          case MessageType.SendContribution:
            return 700
          case MessageType.SynchronizationTimeout:
            return 600 // The timeout triggers after receiving contributions
          default:
            return 0
        }
      }

      return priorityBonus(a.type) > priorityBonus(b.type)
    } else {
      return a.receptionTime < b.receptionTime
    }
  }

  insertMessage(message: Message) {
    if (this.messages.length === 0) {
      this.messages = [message]
    } else {
      this.binaryInsertion(message, 0, this.messages.length - 1)
    }
  }

  private binaryInsertion(element: Message, lower: number, upper: number) {
    if (upper - lower <= 1) {
      if (!this.AIsBeforeB(element, this.messages[lower])) {
        this.messages.splice(lower, 0, element)
      } else if (this.AIsBeforeB(element, this.messages[upper])) {
        this.messages.splice(upper + 1, 0, element)
      } else {
        this.messages.splice(upper, 0, element)
      }
    } else {
      const mid = Math.floor((upper - lower) / 2) + lower
      this.AIsBeforeB(element, this.messages[mid])
        ? this.binaryInsertion(element, mid, upper)
        : this.binaryInsertion(element, lower, mid)
    }
  }
}

export default NodesManager
