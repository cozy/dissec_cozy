import { Message, MessageType } from '../message'
import { Node } from '../node'

export function handleNotifyGroup(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  // NotifyGroup messages are ignored if the node does not know its part of the tree.
  // This occurs when 2 nodes are being replaced concurrently in the same group.
  if (this.node && this.node.children.length > 0) {
    if (!receivedMessage.content.targetGroup) {
      throw new Error(`#${this.id} did not receive targetGroup`)
    }
    if (receivedMessage.content.failedNode === undefined) {
      throw new Error(`#${this.id} did not receive failed node from #${receivedMessage.emitterId}`)
    }

    // Verifying the backup's certificate and signature, then sign the current group and children
    this.localTime += 2 * this.config.averageCryptoTime

    // The node has been notified by a backup that it is joining the group
    // Compare the local members with the received one, keep the newest version
    this.node.members = receivedMessage.content.targetGroup.members
    this.node.parents = receivedMessage.content.targetGroup.parents

    // If this node has not finished receiving contribtions, send the expected list instead
    // This way, the backup can independently check contributors health
    const contributors =
      !this.finishedWorking && this.expectedContributors.length > 0
        ? this.expectedContributors
        : this.contributorsList[this.id]

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
          backupList: this.backupList,
          contributors
        }
      )
    )
  }

  return messages
}
