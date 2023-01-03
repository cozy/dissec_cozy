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
  this.localTime += this.config.averageComputeTime * this.config.modelSize

  // Store the share
  this.contributions[receivedMessage.emitterId] = receivedMessage.content.share
  if (this.contributorsList[this.id] && !this.contributorsList[this.id]?.includes(receivedMessage.emitterId)) {
    this.contributorsList[this.id]!.push(receivedMessage.emitterId)
  }

  // Check if we received shares from all contributors
  const contributors = this.node.children.flatMap(e => e.members)
  const contributions = contributors.map(contributor => this.contributions[contributor]).filter(Boolean)
  if (contributors.length === contributions.length) {
    if (
      this.config.buildingBlocks.synchronization === SynchronizationBlock.NonBlocking ||
      this.config.buildingBlocks.synchronization === SynchronizationBlock.None
    ) {
      // We don't need synchronization
      messages.push(
        this.sendAggregate({
          counter: contributors.length,
          data: contributions.reduce((prev, curr) => prev + curr),
          id: this.aggregationId(contributors.map(String)),
        })
      )
    }

    this.contributorsList[this.id] = contributors
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
