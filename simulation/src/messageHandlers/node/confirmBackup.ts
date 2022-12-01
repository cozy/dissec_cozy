import { Message, MessageType } from '../../message'
import { Node, NodeRole } from '../../node'

export function handleConfirmBackup(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  // The node received a confirmation from one of the parent that contacted it
  if (receivedMessage.content.useAsBackup && this.role === NodeRole.Backup) {
    this.contactedAsABackup = true

    if (!receivedMessage.content.targetGroup) {
      throw new Error(`Backup ${this.id} did not receive the target group in the confirmation`)
    }
    if (receivedMessage.content.failedNode === undefined) {
      throw new Error(`Backup ${this.id} did not receive the group member to needs to be replaced`)
    }

    this.replacedNode = receivedMessage.content.failedNode
    this.parentLastReceivedAggregateId = receivedMessage.content.parentLastReceivedAggregateId

    // Verify Certif + open the encryted channel + sign the notification for members
    this.localTime += 3 * this.cryptoLatency()

    // The node is still available and the parent wants it as a child
    this.node = receivedMessage.content.targetGroup
    this.node.members = this.node.members.map(e => (e !== receivedMessage.content.failedNode ? e : this.id))
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
            failedNode: receivedMessage.content.failedNode,
          }
        )
      )
    }

    // Timeout to abort the protocol in case the group is dead
    messages.push(
      new Message(
        MessageType.NotifyGroupTimeout,
        this.localTime,
        this.localTime + 2 * this.config.averageLatency * this.config.maxToAverageRatio + 3 * this.cryptoLatency(),
        this.id,
        this.id,
        {
          targetGroup: receivedMessage.content.targetGroup,
          failedNode: receivedMessage.content.failedNode,
        }
      )
    )
  } else if (!this.replacedNode) {
    // Backup is not used
    // Turn on availability
    this.contactedAsABackup = false
  }

  return messages
}
