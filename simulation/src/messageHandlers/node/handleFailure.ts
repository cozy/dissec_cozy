import { FailureHandlingBlock, StandbyBlock, SynchronizationBlock } from '../../experimentRunner'
import { Message, MessageType } from '../../message'
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
        this.lastSentAggregateId = this.aggregationId(contributors.map(String))
        this.finishedWorking = true
        messages.push(
          new Message(
            MessageType.SendAggregate,
            this.localTime,
            0, // Don't specify time to let the manager add the latency
            this.id,
            parent,
            {
              aggregate: {
                counter: contributors.length,
                data: contributions.reduce((prev, curr) => prev + curr),
                id: this.lastSentAggregateId,
              },
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
    }
  }

  return messages
}
