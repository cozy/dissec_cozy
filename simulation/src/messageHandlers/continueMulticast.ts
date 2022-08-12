import { Message, MessageType, StopStatus } from '../message'
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
            targetGroup,
          }
        )
      )
    }

    this.backupList = this.backupList.filter(e => !multicastTargets.includes(e))
    if (this.backupList.length > 0) {
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
            remainingBackups: this.backupList,
            failedNode: receivedMessage.content.failedNode,
          }
        )
      )
    } else {
      messages.push(
        new Message(MessageType.StopSimulator, this.localTime, this.localTime, this.id, this.id, {
          status: StopStatus.OutOfBackup,
          targetGroup: this.node,
        })
      )
    }
  }

  return messages
}
