import { Message, MessageType, StopStatus } from '../message'
import { Node } from '../node'

export function handleNotifyGroupTimeout(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (this.queriedNode) {
    // The node received contributors lists and queried data
    // Set a timeout to synchronize if contributions are missing
    messages.push(
      new Message(
        MessageType.SynchronizationTimeout,
        this.localTime,
        this.localTime + this.config.averageLatency * this.config.maxToAverageRatio + 3 * this.cryptoLatency(),
        this.id,
        this.id,
        {
          targetGroup: receivedMessage.content.targetGroup,
          failedNode: receivedMessage.content.failedNode,
        }
      )
    )
  } else if (!this.node?.children.length) {
    // The node still hasn't received children
    // This occurs because others members don't know either, the protocol failed
    messages.push(
      new Message(MessageType.StopSimulator, this.localTime, this.localTime, this.id, this.id, {
        status: StopStatus.SimultaneousFailures,
        targetGroup: this.node,
      })
    )
  }

  return messages
}
