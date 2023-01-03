import { FailureHandlingBlock, SynchronizationBlock } from '../../experimentRunner'
import { arrayEquals, intersectLists } from '../../helpers'
import { Message, MessageType } from '../../message'
import { Node, NodeRole } from '../../node'

export function handleConfirmContributors(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }
  if (!receivedMessage.content.contributors) {
    // Empty contributors
    return messages
  }

  if (!this.contactedAsABackup) {
    // The node is already in the tree, not a backup
    // Do not request data
    this.queriedNode = receivedMessage.content.contributors
  }
  if (!this.queriedNode) {
    this.queriedNode = []
  }
  // TODO: Set this in the backup contacting protocol
  this.role = NodeRole.LeafAggregator

  // The intersection of the local list and the received one
  const intersection = intersectLists(this.contributorsList[this.id], receivedMessage.content.contributors) || []

  // Keep a copy in case the node is sending the confirmation to itself
  const oldContributors = this.contributorsList[this.id]
  // Store the received list
  if (
    !this.contributorsList[receivedMessage.emitterId] &&
    [SynchronizationBlock.FullSynchronization, SynchronizationBlock.LeavesSynchronization].includes(
      this.config.buildingBlocks.synchronization
    ) &&
    intersection.map(e => this.contributions[e]).every(Boolean)
  ) {
    // Send back a confirmation for newly incomming confirmations
    messages.push(
      new Message(MessageType.ConfirmContributors, this.localTime, 0, this.id, receivedMessage.emitterId, {
        contributors: intersection,
      })
    )
  }
  this.contributorsList[receivedMessage.emitterId] = receivedMessage.content.contributors

  if (this.contactedAsABackup && !arrayEquals(oldContributors || [], intersection)) {
    // The node is a backup and received a different list than his local one
    // Query previously unknown contributors for their data
    const newContributors = intersection.filter(
      e => !(this.contributorsList[this.id] || []).concat(this.queriedNode!).includes(e)
    )
    this.contributorsList[this.id] = intersection
    for (const contributor of newContributors) {
      // Memorize that we queried the node to prevent multiple queries
      this.queriedNode.push(contributor)
      messages.push(
        new Message(MessageType.RequestData, this.localTime, 0, this.id, contributor, {
          parents: this.node.members,
        })
      )
    }

    if (newContributors.length > 0 && this.config.buildingBlocks.failureHandling === FailureHandlingBlock.Replace) {
      // In the optimistic versions, add a synchronization trigger if the backup asked for data
      // This happens only for backups joining
      messages.push(
        new Message(
          MessageType.SynchronizationTimeout,
          this.localTime,
          this.localTime + this.config.averageLatency * this.config.maxToAverageRatio + 3 * this.cryptoLatency(),
          this.id,
          this.id,
          {}
        )
      )
    }
  }

  if (
    [SynchronizationBlock.FullSynchronization, SynchronizationBlock.LeavesSynchronization].includes(
      this.config.buildingBlocks.synchronization
    )
  ) {
    this.contributorsList[this.id] = intersection

    if (!arrayEquals(oldContributors || [], intersection)) {
      // The local list changed, tell other members about it
      this.node.members
        .filter(e => e !== this.id)
        .forEach(member =>
          messages.push(
            new Message(MessageType.ConfirmContributors, this.localTime, 0, this.id, member, {
              contributors: this.contributorsList[this.id],
            })
          )
        )

      // The node knows it will need to send a new version
      this.finishedWorking = false
    }

    if (
      !this.finishedWorking &&
      this.node.members
        .map(member => arrayEquals(this.contributorsList[this.id] || [], this.contributorsList[member] || []))
        .every(Boolean) &&
      arrayEquals(
        this.contributorsList[this.id] || [],
        this.node!.children.flatMap(e => e.members).filter(e => this.contributions[e]) || []
      )
    ) {
      // The node has received the same list from each member and has the data, send the aggregate
      messages.push(
        this.sendAggregate({
          counter: this.contributorsList[this.id]!.length,
          data: this.contributorsList[this.id]!.map(e => this.contributions[e]).reduce((prev, curr) => prev + curr, 0),
          id: this.aggregationId(this.contributorsList[this.id]!.map(String)),
        })
      )
    }
  } else if (
    this.config.buildingBlocks.synchronization === SynchronizationBlock.NonBlocking &&
    this.contributorsList[this.id]
  ) {
    // This node received a confirmation and has finished collecting its contributions
    this.contributorsList[this.id] = intersection

    // Send a contributors confirmation to members who might have different list
    for (const m of this.node.members.filter(e => e !== this.id)) {
      if (!arrayEquals(this.contributorsList[this.id] || [], this.contributorsList[m] || [])) {
        messages.push(
          new Message(MessageType.ConfirmContributors, this.localTime, 0, this.id, m, {
            contributors: intersection,
          })
        )
      }
    }

    const nextAggregationId = this.aggregationId(this.contributorsList[this.id]!.map(String))
    if (
      nextAggregationId !== this.lastSentAggregateId &&
      this.contributorsList[this.id]?.map(e => this.contributions[e]).every(Boolean)
    ) {
      // The aggregate version changed and the node has received all expected shares, resend the new version to the parent
      // It immediatly sends the updated aggregate to its parent
      messages.push(
        this.sendAggregate({
          counter: this.contributorsList[this.id]!.length,
          data: this.contributorsList[this.id]!.map(e => this.contributions[e]).reduce((prev, curr) => prev + curr, 0),
          id: this.aggregationId(this.contributorsList[this.id]!.map(String)),
        })
      )
    }
  }

  return messages
}
