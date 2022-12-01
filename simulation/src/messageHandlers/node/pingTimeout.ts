import { Message, MessageType } from '../../message'
import { Node } from '../../node'

export function handlePingTimeout(this: Node): Message[] {
  const messages: Message[] = []

  // Finalize preliminary contributors list
  this.contributorsList[this.id] = this.pingList.slice()

  // Initialize the list of queried note
  this.queriedNode = this.contributorsList[this.id]?.slice()

  // The node sends the list to itself so that if it's the first finalized list, the node also tells its members about it
  messages.push(
    new Message(MessageType.ConfirmContributors, this.localTime, this.localTime, this.id, this.id, {
      contributors: this.contributorsList[this.id],
    })
  )

  return messages
}
