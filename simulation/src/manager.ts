import cloneDeep from 'lodash/cloneDeep'

import { RunConfig } from './experimentRunner'
import { Message, MessageType, StopStatus } from './message'
import Node, { NodeRole } from './node'
import { Generator } from './random'
import TreeNode from './treeNode'

export interface ManagerArguments extends RunConfig {
  debug?: boolean
}

export class NodesManager {
  debug?: boolean
  nodes: { [id: number]: Node }
  querier: number
  messages: Message[]
  oldMessages: Message[]
  messageCounter: number
  globalTime: number
  config: ManagerArguments
  multicastSize: number
  failureRate: number
  lastFailureUpdate: number
  status: StopStatus
  generator: () => number

  constructor(options: ManagerArguments) {
    this.debug = options.debug
    this.nodes = []
    this.querier = 0
    this.messages = []
    this.oldMessages = []
    this.messageCounter = 0
    this.globalTime = 0
    this.lastFailureUpdate = 0
    this.config = options
    this.multicastSize = 5
    this.failureRate = options.failureRate
    this.status = StopStatus.Unfinished
    this.generator = Generator.get(options.seed)
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

  addNode(node: TreeNode, querier?: number): Node {
    if (querier) this.querier = querier
    this.nodes[node.id] = new Node({ node, config: this.config })
    return this.nodes[node.id]
  }

  updateFailures() {
    for (const node of Object.values(this.nodes)) {
      if (node.alive) {
        // Querier can't die
        if (this.generator() < this.failureRate && node.role !== NodeRole.Querier) {
          const newFailure = node.alive
          // The node failed
          node.alive = false
          if (newFailure) {
            node.deathTime = this.globalTime
            if (
              node.node &&
              node.node.children.length !== 0 &&
              node.node.members.map(id => !this.nodes[id].alive && !this.nodes[id].finishedWorking).every(Boolean)
            ) {
              // All members of the group are dead, stop the run because it's dead
              this.messages.push(
                new Message(MessageType.StopSimulator, 0, -1, this.querier, this.querier, {
                  status: StopStatus.GroupDead,
                  targetGroup: node.node,
                })
              )
            }
          }
        }
      }
      if (!node.alive && node.deathTime === 0) {
        node.deathTime = this.globalTime
      }
    }
  }

  transmitMessage(unsentMessage: Message) {
    // Messages wtihout arrival date are added a standard latency
    if (unsentMessage.receptionTime === 0)
      unsentMessage.receptionTime = unsentMessage.emissionTime + this.standardLatency()

    if (this.nodes[unsentMessage.emitterId].alive) {
      this.messages.push(cloneDeep(unsentMessage))
      this.messageCounter++
    }
  }

  handleNextMessage() {
    this.messages.sort((a, b) => {
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
            case MessageType.SendContribution:
              return 700
            case MessageType.SynchronizationTimeout:
              return 600 // The timeout triggers after receiving contributions
            default:
              return 0
          }
        }

        return priorityBonus(a.type) - priorityBonus(b.type)
      } else {
        return b.receptionTime - a.receptionTime
      }
    })
    const message = this.messages.pop()!

    // Save messages for exporting
    this.oldMessages.push(message)

    // Update simulation time and failures
    while (this.lastFailureUpdate + this.config.averageLatency <= message.receptionTime) {
      this.updateFailures()
      // TODO: Find a smarter time step
      this.lastFailureUpdate += this.config.averageLatency
      this.globalTime = this.lastFailureUpdate
    }
    this.globalTime = message.receptionTime

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
          break
      }
    } else if (this.nodes[message.receiverId].localTime > this.config.deadline) {
      this.messages = [new Message(MessageType.StopSimulator, 0, -1, 0, 0, { status: StopStatus.ExceededDeadline })]
    } else if (this.nodes[message.receiverId].alive) {
      this.globalTime = message?.receptionTime
      // Receiving a message creates new ones
      const resultingMessages = this.nodes[message.receiverId].receiveMessage(message)

      if (!resultingMessages) {
        // The message bounced because the node was busy
        // Remove the last message from old messages and put it back in the queue
        this.oldMessages.pop()
        this.messages.push(message)
      } else {
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
    return 2 * this.config.averageLatency * this.generator()
  }
}

export default NodesManager
