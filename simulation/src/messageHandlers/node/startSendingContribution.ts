import { Message, MessageType } from '../../message'
import { Node } from '../../node'

export function handleStartSendingContribution(this: Node, receivedMessage: Message): Message[] {
  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }

  const messages: Message[] = []

  this.finishedWorking = true

  // Schedule the actual data emission once all the work has been done
  const transmissionTime = this.config.modelSize * this.config.averageLatency
  const parents = this.node.parents.filter(e => !this.sentContributions[e])
  for (const parent of parents) {
    this.sentContributions[parent] = true
    messages.push(
      new Message(
        MessageType.FinishContribution,
        this.localTime,
        this.localTime + parents.length * transmissionTime,
        this.id,
        this.id,
        { targetNode: parent }
      )
    )
  }
  this.localTime += parents.length * transmissionTime

  return messages
}
