import { Message, MessageType } from '../../message'
import { Node } from '../../node'
import { Generator } from '../../random'

const generator = Generator.get()

export function handleRequestContribution(this: Node, receivedMessage: Message): Message[] {
  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }
  if (!receivedMessage.content.parents) {
    throw new Error(`Message is missing "parents" content`)
  }

  const messages: Message[] = []

  // Verifying the parent's certificate and signature when sending the data
  // Prepare shares
  this.localTime += 2 * this.cryptoLatency() + this.config.averageComputeTime
  this.shares = Array(this.config.groupSize).fill(0)
  let accumulator = 0
  for (let i = 0; i < this.config.groupSize - 1; i++) {
    // TODO: Use a more general noising process
    const noise = 1000000000 * generator()
    this.shares[i] = this.secretValue + noise
    accumulator += noise
  }
  this.shares[this.shares.length - 1] = this.secretValue - accumulator

  // Schedule the actual data emission once all the work has been done
  const computeTime = 16 * this.config.averageComputeTime * this.config.groupSize
  const transmissionTime = this.config.groupSize * this.config.modelSize * this.config.averageLatency
  messages.push(
    new Message(
      MessageType.PrepareContribution,
      this.localTime,
      this.localTime + computeTime + transmissionTime,
      this.id,
      this.id,
      {}
    )
  )

  return messages
}
