import { Message, MessageType } from '../message'
import { Node } from '../node'

export function handleShareContributors(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`#${this.id} ${receivedMessage.type} requires the node to be in the tree`)
  }
  if (!receivedMessage.content.contributors || receivedMessage.content.contributors.length === 0) {
    throw new Error('Received an empty contributors list, the protocol should stop')
  }

  // Verify the members' certificates and signatures
  this.localTime += 2 * this.config.averageCryptoTime

  // TODO: Receiving enough contributors list should trigger the timeout
  this.contributorsList[receivedMessage.emitterId] = receivedMessage.content.contributors

  if (this.node.members.map(e => this.contributorsList[e]).filter(e => e && e.length > 0).length === this.node?.members.length) {
    // Received a contributors list from each member
    this.mergeContributorsLists()
    for (const member of this.node.members.filter(e => e !== this.id)) {
      messages.push(
        new Message(
          MessageType.ConfirmContributors,
          this.localTime,
          this.localTime,
          this.id,
          member,
          { contributors: this.contributorsList[this.id] }
        )
      )
    }

    this.lastSentAggregateId = this.aggregationId(this.contributorsList[this.id].map(String))
    messages.push(
      new Message(
        MessageType.SendAggregate,
        this.localTime,
        0, // Don't specify time to let the manager add the latency
        this.id,
        this.node.parents[this.node.members.indexOf(this.id)],
        {
          aggregate: {
            counter: this.contributorsList[this.id].length,
            data: this.contributorsList[this.id]
              .map(contributor => this.contributions[contributor])
              .reduce((prev, curr) => prev + curr),
            id: this.lastSentAggregateId
          }
        }
      )
    )

    this.finishedWorking = true
  }

  return messages
}
