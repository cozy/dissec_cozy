import { Message, MessageType } from '../../message'
import { Node, NodeRole } from '../../node'

export function handleNotifyGroup(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  // NotifyGroup messages are ignored if the node does not know its part of the tree.
  // This occurs when 2 nodes are being replaced concurrently in the same group.
  if (this.node && (this.node.children.length > 0 || this.contributorsList[this.id])) {
    // Verifying the backup's certificate + signature + sign the current group and children
    this.localTime += 3 * this.cryptoLatency()

    // The backup will ask again later if the list is not yet known
    const contributors = this.contributorsList[this.id] || this.pingList

    if (this.role !== NodeRole.LeafAggregator) {
      messages.push(
        new Message(
          MessageType.SendChildren,
          this.localTime,
          0, // ASAP
          this.id,
          receivedMessage.emitterId,
          {
            targetGroup: this.node,
            children: this.node.children,
            role: this.role,
            contributors,
          }
        )
      )
    } else {
      messages.push(
        new Message(
          MessageType.ConfirmContributors,
          this.localTime,
          0, // ASAP
          this.id,
          receivedMessage.emitterId,
          {
            targetGroup: this.node,
            children: this.node.children,
            role: this.role,
            contributors,
          }
        )
      )
    }
  }

  return messages
}
