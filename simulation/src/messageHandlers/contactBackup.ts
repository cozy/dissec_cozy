import { Message, MessageType } from '../message'
import { Node, NodeRole } from '../node'

export function handleContactBackup(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (receivedMessage.content.failedNode === undefined) {
    throw new Error(
      `Backup ${this.id} did not receive the group member to needs to be replaced from ${receivedMessage.emitterId}`
    )
  }

  // Verifying the emitter's certificate and signature
  this.localTime += 2 * this.config.averageCryptoTime

  if (this.contactedAsABackup || this.role !== NodeRole.Backup) {
    // The backup is not available
    messages.push(
      new Message(
        MessageType.BackupResponse,
        this.localTime,
        0, // ASAP
        this.id,
        receivedMessage.emitterId,
        {
          backupIsAvailable: false,
          failedNode: receivedMessage.content.failedNode
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
