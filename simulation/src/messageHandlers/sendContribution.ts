import { ProtocolStrategy } from '../experimentRunner'
import { Message, MessageType } from '../message'
import { Node } from '../node'

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

  // Store the share
  this.contributions[receivedMessage.emitterId] = receivedMessage.content.share

  // Check if we received shares from all contributors
  if (this.contributorsList[this.id]?.map(contributor => this.contributions[contributor]).every(Boolean)) {
    // The node received all expected contributions and can continue the protocole
    const parent = this.node.parents[this.node.members.indexOf(this.id)]

    if (this.config.strategy === ProtocolStrategy.Optimistic) {
      // Tell other members
      // This is useful for backups that joined before obtaining a list
      for (const member of this.node.members.filter(e => this.id !== e)) {
        messages.push(
          new Message(MessageType.ConfirmContributors, this.localTime, 0, this.id, member, {
            contributors: this.contributorsList[this.id],
          })
        )
      }
      // Send data to the parent if the node is a backup joining
      this.lastSentAggregateId = this.aggregationId(this.contributorsList[this.id]!.map(String))
      if (this.parentLastReceivedAggregateId !== this.lastSentAggregateId) {
        // Resend only if the agregate changed
        messages.push(
          new Message(
            MessageType.SendAggregate,
            this.localTime,
            0, // Don't specify time to let the manager add the latency
            this.id,
            parent,
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
      this.finishedWorking = true
    } else {
      if (!this.confirmContributors) {
        // Send data to the parent if the node is a backup joining
        this.lastSentAggregateId = this.aggregationId(this.contributorsList[this.id]!.map(String))
        if (this.parentLastReceivedAggregateId !== this.lastSentAggregateId) {
          // Resend only if the agregate changed
          messages.push(
            new Message(
              MessageType.SendAggregate,
              this.localTime,
              0, // Don't specify time to let the manager add the latency
              this.id,
              parent,
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
        this.finishedWorking = true
      } else {
        // Tell other members if the current node is in synchronization
        for (const member of this.node.members.filter(e => this.id !== e)) {
          messages.push(
            new Message(MessageType.ConfirmContributors, this.localTime, 0, this.id, member, {
              contributors: this.contributorsList[this.id],
            })
          )
        }
      }
    }
  }

  return messages
}
