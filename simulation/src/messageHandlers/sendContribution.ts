import { Message, MessageType } from '../message'
import { arrayEquals, Node } from '../node'

export function handleSendContribution(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }
  if (!receivedMessage.content.share) {
    throw new Error(`#${this.id} received a contribution without a share`)
  }

  // Verifying the child's certificate, signature and decrypt the symmetric key
  this.localTime += 3 * this.config.averageCryptoTime

  if (!this.contributorsList[this.id].includes(receivedMessage.emitterId)) {
    this.contributorsList[this.id].push(receivedMessage.emitterId)
  }
  this.contributions[receivedMessage.emitterId] = receivedMessage.content.share

  if (
    this.expectedContributors.length !== 0 &&
    arrayEquals(this.expectedContributors, this.contributorsList[this.id]) &&
    !this.finishedWorking
  ) {
    // The node received all expected contributions and can continue the protocole
    // No need to tell the members because they have the same contributors
    this.lastSentAggregateId = this.aggregationId(this.expectedContributors.map(String))
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
            data: Object.values(this.contributions).reduce((prev, curr) => prev + curr),
            id: this.aggregationId(this.expectedContributors.map(String))
          }
        }
      )
    )
    this.finishedWorking = true
  }

  return messages
}
