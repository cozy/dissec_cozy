import { AVERAGE_COMPUTE, AVERAGE_CRYPTO } from './manager'
import { Message, MessageType } from './message'
import { Generator } from './random'
import TreeNode from './treeNode'

const BASE_NOISE = 10000000

class Node {
  id: number
  node: TreeNode
  localTime: number
  alive: boolean
  shares: number[]

  constructor(node: TreeNode) {
    this.id = node.id
    this.node = node
    this.localTime = 0
    this.alive = true
  }

  receiveMessage(receivedMessage: Message): Message[] {
    const messages: Message[] = []
    this.localTime = Math.max(this.localTime, receivedMessage.receptionTime)

    switch (receivedMessage.type) {
      case MessageType.RequestContribution:
        console.log(
          `Node #${this.id} (time=${
            this.localTime
          }) received a request for contribution`
        )

        // Prepare shares
        this.localTime += AVERAGE_COMPUTE
        // TODO: Better value, not always 50
        this.shares = Array(this.node.members.length).fill(0)
        let accumulator = 0
        const generator = Generator.get()
        for (let i = 0; i < this.node.members.length - 1; i++) {
          this.shares[i] = BASE_NOISE * generator()
          accumulator += this.shares[i]
        }
        this.shares[this.shares.length - 1] = 50 - accumulator

        for (const parent of receivedMessage.content.parents || []) {
          // Open a secure channel
          this.localTime += AVERAGE_CRYPTO

          // Send data to parent
          messages.push(
            new Message(
              MessageType.SendContribution,
              this.localTime,
              0, // Don't specify time to let the manager add the latency
              this.id,
              parent,
              { share: this.shares[this.node.parents.indexOf(parent)] }
            )
          )
        }
        break
      case MessageType.SendContribution:
        console.log(
          `Node #${this.id} (time=${this.localTime}) received a contribution (${
            receivedMessage.content.share
          })`
        )
        break
      default:
        throw new Error('Receiving unknown message type')
    }

    return messages
  }
}

export default Node
