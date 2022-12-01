import { Message } from '../../message'
import { Node } from '../../node'

export function handleContributorPing(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`#${this.id} ${receivedMessage.type} requires the node to be in the tree`)
  }

  // Add the pinger to the ping list
  if (!this.pingList.includes(receivedMessage.emitterId)) {
    this.pingList.push(receivedMessage.emitterId)
  }

  return messages
}
