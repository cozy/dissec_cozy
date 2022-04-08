import { Message, MessageType } from '../message'
import { Node, NodeRole } from '../node'
import TreeNode from '../treeNode'

export function handleConfirmBackup(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  // The node received a confirmation from one of the parent that contacted it
  if (receivedMessage.content.useAsBackup && this.role === NodeRole.Backup) {
    if (!receivedMessage.content.targetGroup) {
      throw new Error(`Backup ${this.id} did not receive the target group in the confirmation`)
    }
    if (receivedMessage.content.failedNode === undefined) {
      throw new Error(`Backup ${this.id} did not receive the group member to needs to be replaced`)
    }

    // Open the encryted channel with the parent and sign the notification for members
    this.localTime += 2 * this.config.averageCrypto

    // The node is still available and the parent wants it as a child
    this.node = TreeNode.fromCopy(receivedMessage.content.targetGroup, this.id)
    this.node.children = [] // The backup receives children later
    this.role = NodeRole.Aggregator // This is temporary, to prevent being reassigned as backup

    // Contact its members to know the children
    for (const member of this.node.members.filter(e => e !== this.id)) {
      messages.push(
        new Message(
          MessageType.NotifyGroup,
          this.localTime,
          0, // ASAP
          this.id,
          member,
          {
            targetGroup: receivedMessage.content.targetGroup,
            failedNode: receivedMessage.content.failedNode
          }
        )
      )
    }

    // Timeout to abort the protocol in case the group is dead
    messages.push(
      new Message(
        MessageType.NotifyGroupTimeout,
        this.localTime,
        this.localTime + 2 * this.config.averageLatency * this.config.maxToAverageRatio,
        this.id,
        this.id,
        {}
      )
    )
  } else {
    // Turn on availability
    this.contactedAsABackup = false
  }

  return messages
}
