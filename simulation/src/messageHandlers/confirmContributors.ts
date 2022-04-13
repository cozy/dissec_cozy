import { arrayEquals } from '../helpers'
import { Message, MessageType } from '../message'
import { Node } from '../node'

export function handleConfirmContributors(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }
  if (!receivedMessage.content.contributors || receivedMessage.content.contributors.length === 0) {
    throw new Error('Received an empty contributors list, the protocol should stop')
  }

  if (!this.finishedWorking) {
    // Storing the final list from the first member
    this.contributorsList[this.id] = receivedMessage.content.contributors

    this.finishedWorking = true
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
            data: this.contributorsList[this.id].map(e => this.contributions[e]).reduce((prev, curr) => prev + curr, 0),
            id: this.aggregationId(this.contributorsList[this.id].map(String))
          }
        }
      )
    )
  } else if (
    !arrayEquals(this.contributorsList[this.id], receivedMessage.content.contributors) &&
    receivedMessage.emitterId !== this.id
  ) {
    // Contributors have changed and the updates comes from another member
    // Updating the contributors list
    this.contributorsList[this.id] = receivedMessage.content.contributors

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
            data: this.contributorsList[this.id].map(e => this.contributions[e]).reduce((prev, curr) => prev + curr, 0),
            id: this.lastSentAggregateId
          }
        }
      )
    )
  }

  return messages
}
