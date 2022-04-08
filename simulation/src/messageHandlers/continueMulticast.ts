import { Message, MessageType } from '../message'
import { Node } from '../node'
import { createGenerator } from '../random'

export function handleContinueMulticast(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (this.continueMulticast) {
    // Not re-signing the contact request because we reuse the initial one
    if (!this.node) {
      throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
    }
    if (receivedMessage.content.failedNode === undefined) {
      throw new Error(`${this.id} did not receive failed node`)
    }

    // Multicasting to a group of the backup list
    const sorterGenerator = createGenerator(this.id.toString())
    const multicastTargets = receivedMessage.content
      .remainingBackups!.sort(() => sorterGenerator() - 0.5)
      .slice(0, this.config.multicastSize)

    for (const backup of multicastTargets) {
      const targetGroup = this.node.children.filter(e => e.members.includes(receivedMessage.content.failedNode!))[0]

      messages.push(
        new Message(
          MessageType.ContactBackup,
          this.localTime,
          0, // ASAP
          this.id,
          backup,
          {
            failedNode: receivedMessage.content.failedNode,
            targetGroup
          }
        )
      )
    }

    const remainingBackups = this.backupList.filter(e => !multicastTargets.includes(e))
    if (remainingBackups.length > 0) {
      // Reschedule a multicast if there are other backups available and the previously contacted ones didn't answer
      this.continueMulticast = true
      messages.push(
        new Message(
          MessageType.ContinueMulticast,
          this.localTime,
          this.localTime + 2 * this.config.averageLatency * this.config.maxToAverageRatio,
          this.id,
          this.id,
          {
            remainingBackups,
            failedNode: receivedMessage.content.failedNode
          }
        )
      )
    } else {
      throw new Error('Ran out of backups...')
    }
  }

  return messages
}
