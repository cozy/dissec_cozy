import { SynchronizationBlock } from '../../experimentRunner'
import { Message, MessageType } from '../../message'
import { Node } from '../../node'

export function handleSendContribution(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }
  if (!receivedMessage.content.share) {
    throw new Error(`#${this.id} received a contribution without a share`)
  }

  // Verifying the child's certificate, signature and decrypt the symmetric key
  this.localTime += 3 * this.cryptoLatency()

  // Store the share
  this.contributions[receivedMessage.emitterId] = receivedMessage.content.share

  // Check if we received shares from all contributors
  const contributors = this.node.children.flatMap(e => e.members)
  const contributions = contributors.map(contributor => this.contributions[contributor]).filter(Boolean)
  if (contributors.length === contributions.length) {
    if (
      this.config.buildingBlocks.synchronization === SynchronizationBlock.NonBlocking ||
      this.config.buildingBlocks.synchronization === SynchronizationBlock.None
    ) {
      // Non blocking sync send the result ASAP
      const parent = this.node.parents[this.node.members.indexOf(this.id)]
      const transmissionTime = this.config.averageLatency * this.config.modelSize
      this.lastSentAggregateId = this.aggregationId(contributors.map(String))
      this.finishedWorking = true
      messages.push(
        new Message(
          MessageType.SendAggregate,
          this.localTime,
          this.localTime + this.manager.standardLatency() + transmissionTime,
          this.id,
          parent,
          {
            aggregate: {
              counter: contributors.length,
              data: contributions.reduce((prev, curr) => prev + curr),
              id: this.lastSentAggregateId,
            },
          }
        )
      )
    }

    if (this.config.buildingBlocks.synchronization !== SynchronizationBlock.None) {
      // Most synchronization techniques send confirmations to neighbors when all contributions are received
      for (const member of this.node.members.filter(e => this.id !== e)) {
        messages.push(
          new Message(MessageType.ConfirmContributors, this.localTime, 0, this.id, member, {
            contributors,
          })
        )
      }
    }
  }

  return messages
}
