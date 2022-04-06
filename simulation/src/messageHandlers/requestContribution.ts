import { Message, MessageType } from '../message'
import { Node, NodeRole } from '../node'
import { Generator } from '../random'

const generator = Generator.get()

export function handleRequestContribution(this: Node, receivedMessage: Message): Message[] {
  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }
  if (!receivedMessage.content.parents) {
    throw new Error(`Message is missing "parents" content`)
  }

  const messages: Message[] = []

  // TODO: Set contributors during initialization
  this.role = NodeRole.Contributor

  // Prepare shares
  this.localTime += this.config.averageCompute
  this.shares = Array(this.node.members.length).fill(0)
  let accumulator = 0
  for (let i = 0; i < this.node.members.length - 1; i++) {
    // TODO: Use a more general noising process
    const noise = 1000000000 * generator()
    this.shares[i] = this.secretValue + noise
    accumulator += noise
  }
  this.shares[this.shares.length - 1] = this.secretValue - accumulator

  for (const parent of receivedMessage.content.parents) {
    // Open a secure channel
    this.localTime += this.config.averageCrypto

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

  return messages
}
