import { FailureHandlingBlock, StandbyBlock } from '../../experimentRunner'
import { Message, MessageType } from '../../message'
import Node from '../../node'

export function handleFailure(this: Node, receivedMessage: Message): Message[] {
  // Only act when the node is in the tree
  // Send notification to nodes with a channel open
  const messages: Message[] = []

  if (
    this.config.buildingBlocks.standby === StandbyBlock.Stay &&
    this.config.buildingBlocks.failureHandling === FailureHandlingBlock.Replace
  ) {
    // Always replacing failed nodes
    // The node handling the failure is the replacement

    // Update the tree
    // Memory is shared across groups so it also updates parent and child groups
    this.node = receivedMessage.content.targetGroup!
    const position = this.node.members.indexOf(receivedMessage.content.failedNode!)!
    this.node.members[position] = this.id

    const msg = (child: number) =>
      new Message(
        MessageType.RequestData,
        this.localTime,
        this.localTime + this.config.averageLatency,
        this.id,
        child,
        {}
      )
    if (this.node.depth === 1) {
      // Asking contributors
      for (const child of this.node.children.flatMap(e => e.members)) {
        messages.push(msg(child))
      }
    } else {
      // Asking aggregators
      for (const child of this.node.children.map(e => e.members[position])) {
        messages.push(msg(child))
      }
    }
  }

  return messages
}
