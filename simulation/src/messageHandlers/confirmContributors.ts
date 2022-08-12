import { ProtocolStrategy } from '../experimentRunner'
import { arrayEquals, intersectLists } from '../helpers'
import { Message, MessageType } from '../message'
import { Node, NodeRole } from '../node'

export function handleConfirmContributors(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }

  if (!this.contactedAsABackup) {
    // The node is already in the tree, not a backup
    // Do not request data
    this.queriedNode = receivedMessage.content.contributors
  }
  if (!this.queriedNode) {
    this.queriedNode = []
  }
  // TODO: Set this in the backup contacting protocol
  this.role = NodeRole.LeafAggregator

  // The intersection of the local list and the received one
  const intersection = intersectLists(this.contributorsList[this.id], receivedMessage.content.contributors) || []

  // Keep a copy in case the node is sending the confirmation to itself
  const oldContributors = this.contributorsList[this.id]
  // Store the received list
  this.contributorsList[receivedMessage.emitterId] = receivedMessage.content.contributors

  if (this.config.strategy === ProtocolStrategy.Pessimistic) {
    this.contributorsList[this.id] = intersection

    if (!arrayEquals(oldContributors || [], intersection)) {
      // The local list changed, tell other members about it
      this.node.members
        .filter(e => e !== this.id)
        .forEach(member =>
          messages.push(
            new Message(MessageType.ConfirmContributors, this.localTime, 0, this.id, member, {
              contributors: this.contributorsList[this.id],
            })
          )
        )

      // The node knows it will need to send a new version
      this.finishedWorking = false
    }

    if (
      !this.finishedWorking &&
      this.node.members
        .map(member => arrayEquals(this.contributorsList[this.id] || [], this.contributorsList[member] || []))
        .every(Boolean)
    ) {
      // The node has received the same list from each member, send the aggregate
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
              id: this.aggregationId(this.contributorsList[this.id]!.map(String)),
            },
          }
        )
      )
      this.finishedWorking = true
    }
  } else {
    if (!arrayEquals(oldContributors || [], intersection)) {
      if (this.contactedAsABackup) {
        // This if branch is only for clarity because only backups can have unknown contributors by now
        // Query previously unknown contributors for their data
        const newContributors = intersection.filter(
          e => !(this.contributorsList[this.id] || []).concat(this.queriedNode!).includes(e)
        )
        this.contributorsList[this.id] = intersection
        for (const contributor of newContributors) {
          // Memorize that we queried the node to prevent multiple queries
          this.queriedNode.push(contributor)
          messages.push(
            new Message(MessageType.RequestData, this.localTime, 0, this.id, contributor, {
              parents: this.node.members,
            })
          )
        }

        if (
          newContributors.length > 0 &&
          (this.config.strategy === ProtocolStrategy.Optimistic || this.config.strategy === ProtocolStrategy.Eager)
        ) {
          // In the optimistic versions, add a synchronization trigger if the backup asked for data
          // This happens only for backups joining
          messages.push(
            new Message(
              MessageType.SynchronizationTimeout,
              this.localTime,
              this.localTime + this.config.averageLatency * this.config.maxToAverageRatio + 3 * this.cryptoLatency(),
              this.id,
              this.id,
              {}
            )
          )
        }
      } else {
        // The node is not a backup
        this.contributorsList[this.id] = intersection

        // The local list changed, tell other members about it
        this.node.members
          .filter(e => e !== this.id)
          .forEach(member =>
            messages.push(
              new Message(MessageType.ConfirmContributors, this.localTime, 0, this.id, member, {
                contributors: this.contributorsList[this.id],
              })
            )
          )
      }

      const nextAggregationId = this.aggregationId(this.contributorsList[this.id]!.map(String))
      if (
        nextAggregationId !== this.lastSentAggregateId &&
        this.contributorsList[this.id]?.map(e => this.contributions[e]).every(Boolean)
      ) {
        // The aggregate version changed and the node has received all expected shares, resend the new version to the parent
        // It immediatly sends the updated aggregate to its parent
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
                id: this.aggregationId(this.contributorsList[this.id]!.map(String)),
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
