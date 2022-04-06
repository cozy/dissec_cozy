import cloneDeep from 'lodash/cloneDeep'

import { RunConfig } from './experimentRunner'
import { Message, MessageType, StopStatus } from './message'
import Node, { NodeRole } from './node'
import { Generator } from './random'
import TreeNode from './treeNode'

// export const AVERAGE_LATENCY = 100 // Average time between emission and reception of a message
// export const MAX_LATENCY = 8 * AVERAGE_LATENCY // The maximum latency for a message
// export const AVERAGE_CRYPTO = 100 // Average cost of an asym. crypto op.
// export const AVERAGE_COMPUTE = 100 // Average cost of local learning and data splitting
// export const HEALTH_CHECK_PERIOD = 3 * MAX_LATENCY // Needs to be greater than 2*MAX_LATENCY to avoid confusing new requests with previous answers
// export const MULTICAST_SIZE = 5 // Number of nodes contacted simulatneously when looking for a backup
// export const BASE_NOISE = 10000000 // The amplitude of noise

// const DEADLINE = 100 * MAX_LATENCY

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

  constructor (options: ManagerArguments) {
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
            if (node.node && node.node.children.length !== 0 && node.node.members
              .map(id => !this.nodes[id].alive && !this.nodes[id].finishedWorking)
              .every(Boolean)
            ) {
              console.log(`Group of node ${node.id} ([${node.node.members}]) died at [${node.node.members.map(m => this.nodes[m].deathTime)}]`)
              this.messages.push(new Message(MessageType.StopSimulator, 0, -1, this.querier, this.querier, { status: StopStatus.GroupDead }))
              // All members of the group are dead, stop the run because it's dead
            }
          }
        }
      }
      if (!node.alive && node.deathTime === 0) node.deathTime = this.globalTime
    }
  }

  transmitMessage(unsentMessage: Message) {
    // Messages wtihout arrival date are added a standard latency
    if (unsentMessage.receptionTime === 0)
      unsentMessage.receptionTime =
        unsentMessage.emissionTime + this.standardLatency()

    if (this.nodes[unsentMessage.emitterId].alive) {
      this.messages.push(cloneDeep(unsentMessage))
      this.messageCounter++
    }
  }

  handleNextMessage() {
    this.messages.sort((a, b) => b.receptionTime - a.receptionTime)
    const message = this.messages.pop()!
    this.oldMessages.push(message)

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
          console.log(`#${message.content.targetGroup?.id} did not receive its children from its members. Members = [${message.content.targetGroup!.members.map(e => `#${e} (${this.nodes[e].alive})`)}]; children = [${message.content.targetGroup!.children}]`)
          break;
      }
    } else if (this.nodes[message.receiverId].localTime > this.config.deadline) {
      this.messages = [new Message(MessageType.StopSimulator, 0, -1, 0, 0, { status: StopStatus.ExceededDeadline })]
    } else if (this.nodes[message.receiverId].alive) {
      this.globalTime = message?.receptionTime
      // Receiving a message creates new ones
      const resultingMessages = this.nodes[message.receiverId].receiveMessage(
        message,
        this.debug
      )
      for (const msg of resultingMessages) {
        this.transmitMessage(msg)
      }
    }
  }

  private standardLatency(): number {
    return 2 * this.config.averageLatency * this.generator()
  }
}

export default NodesManager
