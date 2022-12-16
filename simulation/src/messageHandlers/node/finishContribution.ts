import { Message, MessageType } from '../../message'
import { Node } from '../../node'

export function handleFinishContribution(this: Node, receivedMessage: Message): Message[] {
  if (!this.node) {
    throw new Error(`${this.tag()} is not initialized`)
  }

  const messages: Message[] = []

  // Send the share to each parent
  const parent = receivedMessage.content.targetNode!
  const position = this.node.parents.indexOf(parent)
  if (position >= 0) {
    messages.push(
      new Message(MessageType.SendContribution, this.localTime, 0, this.id, parent, {
        share: this.shares[position],
      })
    )
  }

  return messages
}
