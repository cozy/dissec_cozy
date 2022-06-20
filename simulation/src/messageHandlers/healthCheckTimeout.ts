import { ProtocolStrategy } from '../experimentRunner'
import { Message, MessageType } from '../message'
import { Node } from '../node'
import { createGenerator } from '../random'

export function handleHealthCheckTimeout(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }

  const ongoingChecks = Object.keys(this.ongoingHealthChecks).map(Number)
  for (const unansweredHealthCheck of ongoingChecks) {
    if (this.config.strategy === ProtocolStrategy.Eager) {
      // In eager strategy, tell members to give up their child as well

      // Aggregators don't have secure channel, sign the request
      this.localTime += this.config.averageCryptoTime

      for (const member of this.node.members) {
        messages.push(
          new Message(
            MessageType.GiveUpChild,
            this.localTime,
            member === this.id ? this.localTime : 0,
            this.id,
            member,
            {
              targetNode: unansweredHealthCheck,
            }
          )
        )
      }
    } else {
      // While replacing failed nodes, resume working
      this.finishedWorking = false
      // Adding the node to the list of nodes looking for backup
      this.lookingForBackup[unansweredHealthCheck] = true

      // Multicasting to a group of the backup list
      const sorterGenerator = createGenerator(this.id.toString())
      const multicastTargets = this.backupList.sort(() => sorterGenerator() - 0.5).slice(0, this.config.multicastSize)

      // Signing the contact request
      this.localTime += this.config.averageCryptoTime

      for (const backup of multicastTargets) {
        const targetGroup = this.node.children.find(e => e.members.includes(unansweredHealthCheck))

        messages.push(
          new Message(
            MessageType.ContactBackup,
            this.localTime,
            0, // ASAP
            this.id,
            backup,
            {
              failedNode: unansweredHealthCheck,
              targetGroup: targetGroup?.copy(),
            }
          )
        )
      }

      const remainingBackups = this.backupList.filter(e => !multicastTargets.includes(e))
      if (remainingBackups.length > 0) {
        // Reschedule a multicast in case contacted backups don't answer
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
              failedNode: unansweredHealthCheck,
            }
          )
        )
      } else {
        throw new Error('Ran out of backups...')
      }
    }
  }

  // Remove handled checks
  ongoingChecks.forEach(node => delete this.ongoingHealthChecks[node])

  return messages
}
