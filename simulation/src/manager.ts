import { Message } from './message'
import Node from './node'
import { Generator } from './random'
import TreeNode from './treeNode'

export const AVERAGE_LATENCY = 100 // Average time between emission and reception of a message
export const MAX_LATENCY = 10 * AVERAGE_LATENCY // The maximum latency for a message
export const HEALTH_CHECK_PERIOD = 3 * MAX_LATENCY // Needs to be greater than 2*MAX_LATENCY to avoid confusing new requests with previous answers
export const AVERAGE_CRYPTO = 100 // Average cost of an asym. crypto op.
export const AVERAGE_COMPUTE = 100 // Average cost of local learning and data splitting
export const MULTICAST_SIZE = 5 // Number of nodes contacted simulatneously when looking for a backup

const FAILURE_RATE = 0.0
const DEADLINE = 50 * MAX_LATENCY

class NodesManager {
  nodes: Node[]
  messages: Message[]
  messageCounter: number
  private generator: () => number

  constructor() {
    this.nodes = []
    this.messages = []
    this.messageCounter = 0
    this.generator = Generator.get()
  }

  static createFromTree(root: TreeNode): NodesManager {
    const manager = new NodesManager()

    let i = root.id
    let node = root.findNode(i)
    while (node) {
      manager.addNode(node)
      i += 1
      node = root.findNode(i)
    }

    return manager
  }

  addNode(node: TreeNode): Node {
    this.nodes.push(new Node({ node }))
    return this.nodes[this.nodes.length - 1]
  }

  updateFailures() {
    const generator = Generator.get()
    for (const node of this.nodes) {
      node.alive &&= generator() > FAILURE_RATE
    }
  }

  transmitMessage(unsentMessage: Message) {
    // Messages wtihout arrival date are added a standard latency
    if (unsentMessage.receptionTime === 0)
      unsentMessage.receptionTime =
        unsentMessage.emissionTime + this.standardLatency()

    if (this.nodes[unsentMessage.emitterId].alive) {
      this.messages.push(unsentMessage)
      this.messageCounter++
    }
  }

  handleNextMessage() {
    this.updateFailures()
    this.messages.sort((a, b) => b.receptionTime - a.receptionTime)

    const message = this.messages.pop()
    if (message && this.nodes[message.receiverId].alive && this.nodes[message.receiverId].localTime < DEADLINE) {
      // Receiving a message creates new ones
      const resultingMessages = this.nodes[message.receiverId].receiveMessage(
        message
      )
      for (const msg of resultingMessages) {
        this.transmitMessage(msg)
      }
    }
  }

  log() {
    console.log(
      `Managing ${this.nodes.length} nodes; ${
        this.messages.length
      } pending messages:`
    )
    for (const message of this.messages) {
      console.log(
        `\t-Message ID${message.id} sent from node #${
          message.emitterId
        } to node #${message.receiverId}`
      )
    }
  }

  private standardLatency(): number {
    return 2 * AVERAGE_LATENCY * this.generator()
  }
}

export default NodesManager
