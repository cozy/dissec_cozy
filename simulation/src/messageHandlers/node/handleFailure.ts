import { FailureHandlingBlock, StandbyBlock, SynchronizationBlock } from '../../experimentRunner'
import { Message, MessageType, StopStatus } from '../../message'
import Node, { NodeRole } from '../../node'

export function handleFailure(this: Node, receivedMessage: Message): Message[] {
  // Only act when the node is in the tree
  // Send notification to nodes with a channel open
  const messages: Message[] = []

  if (
    this.config.buildingBlocks.standby === StandbyBlock.Stay &&
    this.config.buildingBlocks.failureHandling === FailureHandlingBlock.Replace
  ) {
    // Always replacing failed nodes
    // The node handling the failure is the replacement

    // Update the tree
    // Memory is shared across groups so it also updates parent and child groups
    this.node = receivedMessage.content.targetGroup!
    const position = this.node.members.indexOf(receivedMessage.content.failedNode!)!
    this.node.members[position] = this.id

    const msg = (child: number) =>
      new Message(
        MessageType.RequestData,
        this.localTime,
        this.localTime + this.config.averageLatency,
        this.id,
        child,
        {}
      )
    if (this.node.depth === 1) {
      // Asking contributors
      for (const child of this.node.children.flatMap(e => e.members)) {
        messages.push(msg(child))
      }
    } else {
      // Asking aggregators
      for (const child of this.node.children.map(e => e.members[position])) {
        messages.push(msg(child))
      }
    }
  } else if (this.config.buildingBlocks.failureHandling === FailureHandlingBlock.Drop) {
    if (this.role === NodeRole.LeafAggregator) {
      // Update knowledge of contributors
      const failedChild = this.node?.children.find(e => e.members.includes(receivedMessage.content.failedNode!))
      if (failedChild) {
        // The first node that handles the message updates the knowledge for all the group because knowledge is shared
        failedChild.members = failedChild.members.filter(e => e !== receivedMessage.content.failedNode)
        this.node!.children = this.node!.children.filter(e => e.members.length > 0)!
      }

      // Send shares if it's now possible
      const contributors = this.node!.children.flatMap(e => e.members)
      const contributions = contributors.map(contributor => this.contributions[contributor]).filter(Boolean)
      if (!this.finishedWorking && contributors.length === contributions.length) {
        const parent = this.node!.parents[this.node!.members.indexOf(this.id)]
        const transmissionTime = (this.config.modelSize - 1) * this.config.averageLatency
        this.lastSentAggregateId = this.aggregationId(contributors.map(String))
        this.finishedWorking = true
        messages.push(
          new Message(
            MessageType.PrepareSendAggregate,
            this.localTime,
            this.localTime + transmissionTime,
            this.id,
            this.id,
            {
              aggregate: {
                counter: contributors.length,
                data: contributions.reduce((prev, curr) => prev + curr),
                id: this.lastSentAggregateId,
              },
              targetNode: parent,
            }
          )
        )
      }

      // Synchronize if needed
      if (this.config.buildingBlocks.synchronization !== SynchronizationBlock.None) {
        for (const member of this.node!.members.filter(e => this.id !== e)) {
          messages.push(
            new Message(MessageType.ConfirmContributors, this.localTime, 0, this.id, member, {
              contributors,
            })
          )
        }
      }
    } else if (this.role === NodeRole.Backup) {
      // The node is a backup being inserted
      this.node = receivedMessage.content.targetGroup
      this.node!.members = this.node?.members.map(e => (e === receivedMessage.content.failedNode ? this.id : e))!
      this.role = this.node?.depth === 1 ? NodeRole.LeafAggregator : NodeRole.Aggregator

      // Ask child for their data
      const position = this.node?.members.indexOf(this.id)!
      if (this.config.buildingBlocks.standby === StandbyBlock.Stop) {
        // On Stop mode, propagate failure if any child finished working
        if (
          this.node!.children.map(e => (e.depth === 0 ? e.members[0] : e.members[position])).filter(
            e => this.manager.nodes[e].finishedWorking || this.manager.nodes[e].deathTime <= this.manager.globalTime
          ).length > 0
        ) {
          // Some child already sent their data or failed, failing
          const propagationLatency = (2 * this.config.depth - this.node!.depth) * this.config.averageLatency
          messages.push(
            new Message(
              MessageType.StopSimulator,
              this.localTime,
              this.localTime + propagationLatency,
              this.id,
              this.id,
              {
                status: StopStatus.FullFailurePropagation,
                failedNode: this.id,
              }
            )
          )

          // Set all nodes as dead
          Object.values(this.manager.nodes).forEach(
            node => (node.deathTime = this.manager.globalTime + propagationLatency)
          )
        }
      }
    }
  }

  return messages
}
