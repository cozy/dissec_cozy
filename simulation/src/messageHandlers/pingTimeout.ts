import { ProtocolStrategy } from '../experimentRunner'
import { Message, MessageType } from '../message'
import { Node } from '../node'

export function handlePingTimeout(this: Node): Message[] {
  const messages: Message[] = []

  // Finalize preliminary contributors list
  this.contributorsList[this.id] = this.pingList.slice()

  // Initialize the list of queried note
  this.queriedNode = this.contributorsList[this.id]?.slice()

  if (this.config.strategy === ProtocolStrategy.Optimistic || this.config.strategy === ProtocolStrategy.Eager) {
    // The first member forwards the list of contributors to its members
    for (const member of this.node!.members) {
      messages.push(
        new Message(MessageType.ConfirmContributors, this.localTime, 0, this.id, member, {
          contributors: this.contributorsList[this.id],
        })
      )
    }
    // HACK: Forget the list and resend it to self
    delete this.contributorsList[this.id]
  }

  return messages
}
