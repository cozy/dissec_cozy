import { Message } from '../message'
import { Node } from '../node'

export function handleFailing(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }

  return messages
}
