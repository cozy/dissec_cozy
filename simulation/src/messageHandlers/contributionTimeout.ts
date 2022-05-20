import { Message, MessageType } from '../message'
import { Node } from '../node'

export function handleContributionTimeout(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }

  // Update local list with received contributors
  this.contributorsList[this.id] = this.contributorsList[this.id]?.filter(
    (contributor) => this.contributions[contributor]
  )

  // The timeout triggered, share with other members
  // TODO: This is pessimistic, do optimistic version
  // Share received contributors with other members and await a reply
  for (const member of this.node.members.filter((e) => e !== this.id)) {
    messages.push(
      new Message(MessageType.ConfirmContributors, this.localTime, 0, this.id, member, {
        contributors: this.contributorsList[this.id]?.filter((e) => this.contributions[e]),
      })
    )
  }

  messages.push(
    new Message(
      MessageType.SynchronizationTimeout,
      this.localTime,
      this.localTime + 2 * this.config.averageLatency * this.config.maxToAverageRatio,
      this.id,
      this.id,
      {}
    )
  )

  return messages
}
