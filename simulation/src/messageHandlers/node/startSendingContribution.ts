import { Message, MessageType } from '../../message'
import { Node } from '../../node'

export function handleStartSendingContribution(this: Node, receivedMessage: Message): Message[] {
  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }

  const messages: Message[] = []

  this.finishedWorking = true

  // Schedule the actual data emission once all the work has been done
  const transmissionTime = this.config.groupSize * this.config.modelSize * this.config.averageLatency
  messages.push(
    new Message(
      MessageType.PrepareContribution,
      this.localTime,
      this.localTime + transmissionTime,
      this.id,
      this.id,
      {}
    )
  )

  return messages
}
