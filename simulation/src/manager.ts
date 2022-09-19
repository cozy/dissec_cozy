import cloneDeep from 'lodash/cloneDeep'
import rayleigh from '@stdlib/random-base-rayleigh'

import { RunConfig } from './experimentRunner'
import { Message, MessageType, StopStatus } from './message'
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
  nodes: { [id: number]: Node } = {}
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

  constructor(options: ManagerArguments) {
    this.debug = options.debug
    this.config = options
    this.multicastSize = options.multicastSize
    this.failureRate = options.failureRate
    this.status = StopStatus.Unfinished
    this.generator = Generator.get(options.seed)

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

    let i = root.id
    let node = root.findNode(i)
    while (node) {
      manager.addNode(node)
      i += 1
      node = root.findNode(i)
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
    this.nodes[node.id] = new Node({ node, config: this.config })
    return this.nodes[node.id]
  }

  updateFailures() {
    if (this.config.random) {
      for (const node of Object.values(this.nodes)) {
        if (node.alive) {
          // Querier can't die
          if (this.generator() < this.failureRate && node.role !== NodeRole.Querier) {
            node.alive = false
            node.deathTime = this.globalTime
            this.failuresPerRole[node.role] += 1
            if (
              node.node &&
              node.node.children.length !== 0 &&
              node.node.members.map(id => !this.nodes[id].alive && !this.nodes[id].finishedWorking).every(Boolean)
            ) {
              // All members of the group are dead, stop the run because it's dead
              this.messages.push(
                new Message(MessageType.StopSimulator, 0, this.globalTime, this.querier, this.querier, {
                  status: StopStatus.GroupDead,
                  targetGroup: node.node,
                })
              )
            }
          }
        }
      }
    } else {
      const nodesArray = Object.values(this.nodes).filter(e => e.alive && e.role !== NodeRole.Querier)
      this.nextStepFailures += this.config.failureRate * nodesArray.length
      const failures = Math.floor(this.nextStepFailures)
      this.nextStepFailures -= failures

      // Randomly order the nodes, the first nodes will fail
      const failedNodes = nodesArray.sort(() => this.generator() - 0.5)
      for (const node of failedNodes.slice(0, failures)) {
        node.alive = false
        node.deathTime = this.globalTime
        this.failuresPerRole[node.role] += 1
        if (
          node.node &&
          node.node.children.length !== 0 &&
          node.node.members.map(id => !this.nodes[id].alive && !this.nodes[id].finishedWorking).every(Boolean)
        ) {
          // All members of the group are dead, stop the run because it's dead
          this.messages.push(
            new Message(MessageType.StopSimulator, 0, this.globalTime, this.querier, this.querier, {
              status: StopStatus.GroupDead,
              targetGroup: node.node,
            })
          )
        }
      }
    }
  }

  transmitMessage(unsentMessage: Message) {
    // Messages wtihout arrival date are added a standard latency
    if (unsentMessage.receptionTime === 0)
      unsentMessage.receptionTime = unsentMessage.emissionTime + this.standardLatency()

    if (this.nodes[unsentMessage.emitterId].alive) {
      this.insertMessage(cloneDeep(unsentMessage))
      this.messageCounter++
    }
  }

  handleNextMessage() {
    const message = this.messages.pop()!

    if (message.type === MessageType.StopSimulator) {
      // Flushing the message queue
      this.messages = []
      this.status = message.content.status!

      switch (this.status) {
        case StopStatus.SimultaneousFailures:
          console.log(
            `#${
              message.content.targetGroup?.id
            } did not receive its children from its members. Members = [${message.content.targetGroup!.members.map(
              e => `#${e} (${this.nodes[e].alive}@${this.nodes[e].deathTime})`
            )}]; children = [${message.content.targetGroup!.children}]`
          )
          break
        case StopStatus.GroupDead:
          console.log(
            `Group of node [${
              message.content.targetGroup!.members
            }]) died at [${message.content.targetGroup!.members.map(m => this.nodes[m].deathTime)}]`
          )
        case StopStatus.Success:
          this.finalNumberContributors = message.content.contributors?.length || 0
          break
      }
    } else if (this.nodes[message.receiverId].localTime > this.config.deadline) {
      this.messages = [new Message(MessageType.StopSimulator, 0, -1, 0, 0, { status: StopStatus.ExceededDeadline })]
    } else if (this.nodes[message.receiverId].alive) {
      // Update simulation time and failures
      while (this.lastFailureUpdate + this.config.failCheckPeriod <= message.receptionTime) {
        this.updateFailures()
        this.lastFailureUpdate += this.config.failCheckPeriod
        this.globalTime = this.lastFailureUpdate
      }

      this.globalTime = message.receptionTime
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
        if (message.type === MessageType.SendAggregate) {
          this.circulatingAggregateIds[message.content.aggregate!.id] = true
        }
        if (message.content.share || message.content.aggregate?.data) {
          this.usedBandwidth += 1
          this.bandwidthPerRole[this.nodes[message.emitterId].role] += 1
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
        log(this.nodes[child.id])
      }
      console.groupEnd()
    }

    log(querier)
  }

  private standardLatency(): number {
    if (this.config.random) {
      // TODO: Model latency
      return Math.max(0, Math.min(this.config.averageLatency * this.config.maxToAverageRatio, this.rayleigh()))
    } else {
      return this.config.averageLatency
    }
  }

  private AIsBeforeB(a: Message, b: Message): boolean {
    // Use priorities to order message arriving at the same time
    if (b.receptionTime === a.receptionTime) {
      const priorityBonus = (type: MessageType) => {
        switch (type) {
          case MessageType.PingTimeout:
            return 1000
          case MessageType.ContributionTimeout:
            return 1000
          case MessageType.NotifyGroupTimeout:
            return 1000
          case MessageType.CheckHealth:
            return 900
          case MessageType.NotifyGroup:
            return 800
          case MessageType.ContactBackup:
            return 800
          case MessageType.ConfirmBackup:
            return 800
          case MessageType.BackupResponse:
            return 800
          case MessageType.ContributorPing:
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

  private insertMessage(message: Message) {
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
