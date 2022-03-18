import { Node } from "../node"
import { Message, MessageType } from "../message"

export function handleBackupResponse(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  if (!receivedMessage.content.failedNode)
    throw new Error(`Backup ${this.id} did not receive the group member to needs to be replaced`)

  if (receivedMessage.content.backupIsAvailable && this.continueMulticast) {
    // The parent received a response and is still looking for a backup
    // Accept this one, reject future ones
    this.continueMulticast = false

    const child = this.node.children.filter(e =>
      e.members.includes(receivedMessage.content.failedNode!)
    )[0] // The group that the backup will join
    const failedPosition = child.members.indexOf(
      receivedMessage.content.failedNode
    )

    // Update child group
    child.members[failedPosition] = receivedMessage.emitterId
    child.parents = this.node.members

    // The backup needs to receive a confirmation before continue the protocole
    messages.push(
      new Message(
        MessageType.ConfirmBackup,
        this.localTime,
        0, // ASAP
        this.id,
        receivedMessage.emitterId,
        {
          useAsBackup: true,
          targetGroup: child,
          failedNode: receivedMessage.content.failedNode
        }
      )
    )
  } else {
    // Tell the backup it's not needed
    messages.push(
      new Message(
        MessageType.ConfirmBackup,
        this.localTime,
        0, // ASAP
        this.id,
        receivedMessage.emitterId,
        {
          useAsBackup: false
        }
      )
    )
  }

  return messages
}
