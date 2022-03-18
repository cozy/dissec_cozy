import { Node, NodeRole } from "../node"
import { Message, MessageType } from "../message"
import TreeNode from "../treeNode"

export function handleConfirmBackup(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  // The node received a confirmation from one of the parent that contacted it
  if (receivedMessage.content.useAsBackup && this.role === NodeRole.Backup) {
    if (!receivedMessage.content.targetGroup)
      throw new Error(`Backup ${this.id} did not receive the target group in the confirmation`)
    if (!receivedMessage.content.failedNode)
      throw new Error(`Backup ${this.id} did not receive the group member to needs to be replaced`)

    // The node is still available and the parent wants it as a child
    this.node = TreeNode.fromCopy(receivedMessage.content.targetGroup, this.id)
    this.node.children = [] // The backup receives children later
    this.role = NodeRole.Aggregator // This is temporary, to prevent being reassigned as backup

    // Contact its members to know the children
    for (const member of this.node.members.map(e => e === receivedMessage.content.failedNode ? this.id : e).filter(m => m !== this.id)) {
      messages.push(
        new Message(
          MessageType.NotifyGroup,
          this.localTime,
          0, // ASAP
          this.id,
          member,
          {
            failedNode: receivedMessage.content.failedNode,
          }
        )
      )
    }
  } else {
    // Turn on availability
    this.contactedAsABackup = false
  }

  return messages
}
