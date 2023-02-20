import { Message, MessageType } from '../../message'
import { Node } from '../../node'

export function handleFinishSendingAggregate(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${this.id} is not in the tree`)
  }
  if (!receivedMessage.content.aggregate) {
    throw new Error('Received an empty aggregate')
  }
  if (receivedMessage.content.targetNode === undefined) {
    throw new Error(`Invalid aggregate receiver`)
  }

  // The last packet is being sent

  const aggregate = receivedMessage.content.aggregate
  messages.push(
    new Message(
      MessageType.SendAggregate,
      this.localTime,
      this.localTime + 1 / this.config.averageBandwidth,
      this.id,
      receivedMessage.content.targetNode,
      {
        aggregate,
      }
    )
  )

  return messages
}
