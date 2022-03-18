import { Node, NodeRole } from "../node"
import { Message, MessageType } from "../message"

export function handleContactBackup(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (this.contactedAsABackup || this.role !== NodeRole.Backup) {
    messages.push(
      new Message(
        MessageType.BackupResponse,
        this.localTime,
        0, // ASAP
        this.id,
        receivedMessage.emitterId,
        {
          backupIsAvailable: false
        }
      )
    )
  } else {
    // The backup is available
    this.contactedAsABackup = true
    messages.push(
      new Message(
        MessageType.BackupResponse,
        this.localTime,
        0, // ASAP
        this.id,
        receivedMessage.emitterId,
        {
          backupIsAvailable: true,
          failedNode: receivedMessage.content.failedNode,
          targetGroup: receivedMessage.content.targetGroup
        }
      )
    )

    // TODO: Schedule a timeout to allow this node to be contacted as a backup again if the node who contacted it fails before telling it it's not used as a backup

    // Start querying members
  }

  return messages
}
