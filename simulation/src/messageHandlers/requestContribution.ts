import { ProtocolStrategy } from '../experimentRunner'
import { Message, MessageType } from '../message'
import { Node } from '../node'
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

  // Retransmit and answer to pings without verifications because it's does not leak info
  if (this.config.strategy === ProtocolStrategy.Pessimistic) {
    // Pessimists inform every parent that they will contribute
    for (const parent of receivedMessage.content.parents) {
      messages.push(
        new Message(
          MessageType.ContributorPing,
          this.localTime,
          0, // Don't specify time to let the manager add the latency
          this.id,
          parent,
          {}
        )
      )
    }
  } else {
    // Optimists only inform the first parent that they will contribute
    messages.push(
      new Message(
        MessageType.ContributorPing,
        this.localTime,
        0, // Don't specify time to let the manager add the latency
        this.id,
        receivedMessage.content.parents[0],
        {}
      )
    )
  }

  // Verifying the parent's certificate and signature when sending the data
  // Prepare shares
  this.localTime += this.config.averageComputeTime
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
    // Send data to parent
    messages.push(
      new Message(
        MessageType.PrepareContribution,
        this.localTime,
        0, // Don't specify time to let the manager add the latency
        this.id,
        this.id,
        { share: this.shares[this.node.parents.indexOf(parent)], targetNode: parent }
      )
    )
  }

  return messages
}
