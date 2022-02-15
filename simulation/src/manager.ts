import { Message } from './message'
import Node from './node'
import { Generator } from './random'
import TreeNode from './treeNode'

const FAILURE_RATE = 0.0

class NodesManager {
  nodes: Node[]
  messages: Message[]

  constructor() {
    this.nodes = []
    this.messages = []
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
    this.nodes.push(new Node(node))
    return this.nodes[this.nodes.length - 1]
  }

  updateFailures() {
    const generator = Generator.get()
    for (const node of this.nodes) {
      node.alive = generator() > FAILURE_RATE
    }
  }

  transmitMessage(unsentMessage: Message) {
    if (this.nodes[unsentMessage.emitterId].alive) {
      this.messages.push(
        ...this.nodes[unsentMessage.receiverId].emitMessage(unsentMessage)
      )
    }
  }

  handleNextMessage() {
    this.updateFailures()
    this.messages.sort((a, b) => b.receptionTime - a.receptionTime)

    const message = this.messages.pop()
    if (message && this.nodes[message.receiverId].alive) {
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
    console.log(`Managing ${this.nodes.length} nodes; ${this.messages.length} pending messages:`)
    for(const message of this.messages) {
      console.log(`\t-Message ID${message.id} sent from node #${message.emitterId} to node #${message.receiverId}`)
    }
  }
}

export default NodesManager
