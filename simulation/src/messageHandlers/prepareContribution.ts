import { Message, MessageType } from '../message'
import { Node } from '../node'

export function handlePrepareContribution(this: Node, receivedMessage: Message): Message[] {
  if (!receivedMessage.content.targetNode) {
    throw new Error(`Node #${this.id} did not receive the target of the share`)
  }
  if (!receivedMessage.content.share) {
    throw new Error(`Node #${this.id} did not receive the share`)
  }

  const messages: Message[] = []

  // The query has been verified, just open the channel
  this.localTime += this.config.averageCryptoTime

  // Send the certificate, key and share
  messages.push(
    new Message(MessageType.SendContribution, this.localTime, 0, this.id, receivedMessage.content.targetNode, {
      share: receivedMessage.content.share,
    })
  )

  return messages
}
