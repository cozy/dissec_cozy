import { Message, MessageType } from '../../message'
import { Node } from '../../node'

export function handlePrepareSendAggregate(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${this.id} is not in the tree`)
  }
  if (!receivedMessage.content.aggregate) {
    throw new Error('Received an empty aggregate')
  }

  // The last packet is being sent

  const aggregate = receivedMessage.content.aggregate
  messages.push(
    new Message(MessageType.SendAggregate, this.localTime, 0, this.id, receivedMessage.content.targetNode!, {
      aggregate,
    })
  )

  return messages
}
