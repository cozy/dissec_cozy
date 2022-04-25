import { arrayEquals } from '../helpers'
import { Message, MessageType, StopStatus } from '../message'
import { Node } from '../node'

export function handleContributionTimeout(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }

  if (this.expectedContributors.length !== 0) {
    if (!arrayEquals(this.expectedContributors, this.contributorsList[this.id])) {
      // Contributors changed
      if (this.contributorsList[this.id].length === 0) {
        // All contributors are dead, the protocol has to stop
        return [
          new Message(MessageType.StopSimulator, this.localTime, this.localTime, this.id, this.id, {
            status: StopStatus.AllContributorsDead
          })
        ]
      }

      // Inform other members
      for (const member of this.node.members.filter(e => e !== this.id)) {
        messages.push(
          new Message(
            MessageType.ConfirmContributors,
            this.localTime,
            0, // Don't specify time to let the manager add the latency
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
              id: this.aggregationId(this.contributorsList[this.id].map(String))
            }
          }
        )
      )

      this.finishedWorking = true
    }

    return messages
  }

  if (this.id === this.node.members[0] && !this.finishedWorking) {
    this.mergeContributorsLists()

    for (const member of this.node.members.filter(e => e !== this.id)) {
      messages.push(
        new Message(
          MessageType.ConfirmContributors,
          this.localTime,
          0, // Don't specify time to let the manager add the latency
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
  } else if (this.id !== this.node.members[0]) {
    // Group members send their contributors list to the first member
    messages.push(
      new Message(
        MessageType.ShareContributors,
        this.localTime,
        0, // Don't specify time to let the manager add the latency
        this.id,
        this.node.members[0],
        { contributors: this.contributorsList[this.id] }
      )
    )

    // Also send themselves a message to confirm contributors even if the first member is down
    messages.push(
      new Message(
        MessageType.ConfirmContributors,
        this.localTime,
        this.localTime + 2 * this.config.averageLatency * this.config.maxToAverageRatio, // wait for a back and forth with the first member
        this.id,
        this.id,
        { contributors: this.contributorsList[this.id] }
      )
    )
  }

  return messages
}
