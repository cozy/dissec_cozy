import { Message, MessageType } from './message'
import Node, { NodeRole } from './node'
import { Generator } from './random'
import TreeNode from './treeNode'

export const AVERAGE_LATENCY = 100 // Average time between emission and reception of a message
export const MAX_LATENCY = 10 * AVERAGE_LATENCY // The maximum latency for a message
export const HEALTH_CHECK_PERIOD = 4 * MAX_LATENCY // Needs to be greater than 2*MAX_LATENCY to avoid confusing new requests with previous answers
export const AVERAGE_CRYPTO = 100 // Average cost of an asym. crypto op.
export const AVERAGE_COMPUTE = 100 // Average cost of local learning and data splitting
export const MULTICAST_SIZE = 5 // Number of nodes contacted simulatneously when looking for a backup
export const BASE_NOISE = 10000000 // The amplitude of noise

const FAILURE_RATE = 0.0003
const DEADLINE = 100 * MAX_LATENCY

class NodesManager {
  nodes: { [id: number]: Node }
  messages: Message[]
  oldMessages: Message[]
  messageCounter: number
  globalTime: number
  successfulExecution: boolean
  generator: () => number

  constructor(seed: string = "42") {
    this.nodes = []
    this.messages = []
    this.oldMessages = []
    this.messageCounter = 0
    this.globalTime = 0
    this.successfulExecution = false
    this.generator = Generator.get(seed)
  }

  static createFromTree(root: TreeNode, options: { seed?: string } = {}): NodesManager {
    const manager = new NodesManager(options.seed)

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
    this.nodes[node.id] = new Node({ node })
    return this.nodes[node.id]
  }

  updateFailures() {
    const generator = Generator.get()
    for (const node of Object.values(this.nodes)) {
      // TODO: Currently only cause failures on aggregators, not contributors
      if (!node.node || node.node.children.length !== 0) node.alive &&= generator() > FAILURE_RATE
      if (node.node?.members.map(id => !this.nodes[id].alive).every(Boolean)) // All members of the group are dead
        this.messages.push(new Message(MessageType.StopSimulator, 0, -1, 0, 0, { success: false }))
      if (!node.alive && node.role === NodeRole.Querier) node.alive = true // Querier can't die
      if (!node.alive && node.deathTime === 0) node.deathTime = this.globalTime
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

    const message = this.messages.pop()!
    this.oldMessages.push(message)
    this.globalTime = message.receptionTime
    if (message.type === MessageType.StopSimulator) {
      console.log(`Finished ${message.content.success ? "successful" : "failed"} simulation!`)
      console.log(`${this.messages.length} outstanding messages are of type [${Array.from(new Set(this.messages.map(e => e.type)))}]`)

      // Flushing the message queue
      this.messages = []
      this.successfulExecution = message.content.success!
    } else if(this.nodes[message.receiverId].localTime > DEADLINE) {
      this.messages = []
    } else if (this.nodes[message.receiverId].alive) {
      this.globalTime = message?.receptionTime
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
      `Managing ${Object.keys(this.nodes).length} nodes; ${this.messages.length
      } pending messages:`
    )
    for (const message of this.messages) {
      console.log(
        `\t-Message ID${message.id} sent from node #${message.emitterId
        } to node #${message.receiverId}`
      )
    }
  }

  private standardLatency(): number {
    return 2 * AVERAGE_LATENCY * this.generator()
  }
}

export default NodesManager
