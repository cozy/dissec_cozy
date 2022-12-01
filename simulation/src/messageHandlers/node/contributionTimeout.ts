import { ProtocolStrategy } from '../../experimentRunner'
import { arrayEquals } from '../../helpers'
import { Message, MessageType } from '../../message'
import { Node } from '../../node'

export function handleContributionTimeout(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }

  // Contribution phase is over, leaf agregators should have receivedd all contributions.
  // The contributions they have already received is a superset of the possible future lists.

  if (this.config.strategy === ProtocolStrategy.Pessimistic) {
    // If pessimistic, the node should have received a list of contributors by now.
    // Either from the contributors themselves after the request, or from members when joining as a backup

    // Update the list to exclude contributors who did not send anything
    this.contributorsList[this.id] = this.contributorsList[this.id]?.filter(
      contributor => this.contributions[contributor]
    )

    // Share received contributors with other members and await a reply
    for (const member of this.node.members.filter(e => e !== this.id)) {
      messages.push(
        new Message(MessageType.ConfirmContributors, this.localTime, 0, this.id, member, {
          contributors: this.contributorsList[this.id]?.filter(e => this.contributions[e]),
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
  } else {
    if (!this.contributorsList[this.id]?.length) {
      // The node has not finalized its contributors list yet
      // It was a member of a group where the first node died
      // The local list is the set of contributors who sent data
      this.contributorsList[this.id] = Object.keys(this.contributions).map(Number)
    }

    const newContributors = this.contributorsList[this.id]?.filter(contributor => this.contributions[contributor])

    if (!arrayEquals(this.contributorsList[this.id] || [], newContributors || [])) {
      // Inform members if contributors changed
      this.contributorsList[this.id] = newContributors
      for (const member of this.node.members.filter(e => e !== this.id)) {
        messages.push(
          new Message(MessageType.ConfirmContributors, this.localTime, 0, this.id, member, {
            contributors: this.contributorsList[this.id]?.filter(e => this.contributions[e]),
          })
        )
      }
    }

    if (!this.finishedWorking) {
      // Send the current aggregate
      this.lastSentAggregateId = this.aggregationId(this.contributorsList[this.id]!.map(String))
      this.finishedWorking = true
      messages.push(
        new Message(
          MessageType.SendAggregate,
          this.localTime,
          0, // Don't specify time to let the manager add the latency
          this.id,
          this.node.parents[this.node.members.indexOf(this.id)],
          {
            aggregate: {
              counter: this.contributorsList[this.id]!.length,
              data: this.contributorsList[this.id]!.map(e => this.contributions[e]).reduce(
                (prev, curr) => prev + curr,
                0
              ),
              id: this.lastSentAggregateId,
            },
          }
        )
      )
    }
  }

  return messages
}
