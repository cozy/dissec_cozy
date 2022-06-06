import { ProtocolStrategy } from '../experimentRunner'
import { arrayEquals } from '../helpers'
import { Message, MessageType } from '../message'
import { Node } from '../node'

export function handleContributionTimeout(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }

  // Update local list with received contributors
  const newContributors = this.contributorsList[this.id]?.filter(contributor => this.contributions[contributor])

  if (this.config.strategy === ProtocolStrategy.Pessimistic) {
    // The timeout triggered, share with other members
    this.contributorsList[this.id] = newContributors
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
    if (this.node.members[0] === this.id || this.contactedAsABackup) {
      // This node is the member responsible of informing its members or a joining backup
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
    } else {
      // Do nothing we if already received a list from the first member
      if (!this.contributorsList[this.id]) {
        // The leader died before sending its contributor list
        this.contributorsList[this.id] = Object.keys(this.contributions).map(Number)
        this.queriedNode = this.contributorsList[this.id]

        // Inform other members
        for (const member of this.node.members.filter(e => e !== this.id)) {
          messages.push(
            new Message(MessageType.ConfirmContributors, this.localTime, 0, this.id, member, {
              contributors: this.contributorsList[this.id]?.filter(e => this.contributions[e]),
            })
          )
        }

        // Optimistically send the current aggregate
        this.lastSentAggregateId = this.aggregationId(this.contributorsList[this.id]!.map(String))
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
      } else if (!arrayEquals(this.contributorsList[this.id] || [], newContributors || [])) {
        // Some contributors died before sending their contribution
        // Inform member before sending the aggregate
        for (const member of this.node.members.filter(e => e !== this.id)) {
          messages.push(
            new Message(MessageType.ConfirmContributors, this.localTime, 0, this.id, member, {
              contributors: this.contributorsList[this.id]?.filter(e => this.contributions[e]),
            })
          )
        }

        this.lastSentAggregateId = this.aggregationId(this.contributorsList[this.id]!.map(String))
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
        this.finishedWorking = true
      }
    }
  }

  return messages
}
