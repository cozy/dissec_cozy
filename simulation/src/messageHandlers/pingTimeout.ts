import { Message } from '../message'
import { Node } from '../node'

export function handlePingTimeout(this: Node): Message[] {
  const messages: Message[] = []

  // Finalize preliminary contributors list
  this.contributorsList[this.id] = this.pingList.slice()

  // Initialize the list of queried note
  this.queriedNode = this.contributorsList[this.id]?.slice()

  return messages
}
