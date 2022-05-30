import { Message, MessageType, StopStatus } from '../message'
import { Node } from '../node'

export function handleSynchronizationTimeout(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }

  const receivedContributions = this.contributorsList[this.id]?.map(contributor => this.contributions[contributor])

  if (!(receivedContributions && receivedContributions.every(Boolean))) {
    // The timeout triggered and some contributions are still missing
    if (this.queriedNode) {
      // The node asked its members for contributors
      if (this.queriedNode.length === 0) {
        // The node does not know its contributors yet
        // Keep polling contributors from members
        for (const member of this.node.members.filter(e => e !== this.id)) {
          messages.push(
            new Message(
              MessageType.NotifyGroup,
              this.localTime,
              this.localTime + 2 * this.config.averageLatency * this.config.maxToAverageRatio,
              this.id,
              member,
              {}
            )
          )
        }
        messages.push(
          new Message(
            MessageType.NotifyGroupTimeout,
            this.localTime,
            this.localTime + 4 * this.config.averageLatency * this.config.maxToAverageRatio,
            this.id,
            this.id,
            {}
          )
        )
      } else {
        // Some contributors died
        // Update the contributors list, inform members and send the aggregate
        this.contributorsList[this.id] = this.contributorsList[this.id]?.filter(
          contributor => this.contributions[contributor]
        )
        if (!this.contributorsList[this.id]?.map(contributor => this.contributions[contributor]).length) {
          // Received 0 contributions, contributors are dead
          messages.push(
            new Message(MessageType.StopSimulator, this.localTime, this.localTime, this.id, this.id, {
              status: StopStatus.AllContributorsDead,
            })
          )
        } else {
          for (const member of this.node.members.filter(e => e !== this.id)) {
            messages.push(
              new Message(MessageType.ConfirmContributors, this.localTime, 0, this.id, member, {
                contributors: this.contributorsList[this.id],
              })
            )
          }
          this.lastSentAggregateId = this.aggregationId(this.contributorsList[this.id]!.map(String))
          messages.push(
            new Message(
              MessageType.SendAggregate,
              this.localTime,
              0,
              this.id,
              this.node.parents[this.node.members.indexOf(this.id)],
              {
                aggregate: {
                  counter: this.contributorsList[this.id]!.length,
                  data: this.contributorsList[this.id]!.map(contributor => this.contributions[contributor]).reduce(
                    (prev, curr) => prev + curr
                  ),
                  id: this.lastSentAggregateId,
                },
              }
            )
          )
        }
      }
    } else {
      throw new Error(`Node #${this.id} timed out waiting for contributors confirmation and is missing contributions`)
    }
  } else if (!this.finishedWorking) {
    // Did not finish aggregating but received all contributions
    // Send the aggregate
    this.lastSentAggregateId = this.aggregationId(this.contributorsList[this.id]!.map(String))
    messages.push(
      new Message(
        MessageType.SendAggregate,
        this.localTime,
        0,
        this.id,
        this.node.parents[this.node.members.indexOf(this.id)],
        {
          aggregate: {
            counter: this.contributorsList[this.id]!.length,
            data: this.contributorsList[this.id]!.map(contributor => this.contributions[contributor]).reduce(
              (prev, curr) => prev + curr
            ),
            id: this.lastSentAggregateId,
          },
        }
      )
    )
  }

  return messages
}
