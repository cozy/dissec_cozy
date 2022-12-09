import { Message, MessageType } from '../../message'
import { Node } from '../../node'

export function handlePrepareContribution(this: Node, _: Message): Message[] {
  if (!this.node) {
    throw new Error(`${this.tag()} is not initialized`)
  }

  const messages: Message[] = []

  // Send the share to each parent
  for (const i in this.node.parents) {
    messages.push(
      new Message(MessageType.SendContribution, this.localTime, 0, this.id, this.node.parents[i], {
        share: this.shares[i],
      })
    )
  }

  return messages
}
