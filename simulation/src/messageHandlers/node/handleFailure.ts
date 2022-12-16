import {
  FailureHandlingBlock,
  FailurePropagationBlock,
  StandbyBlock,
  SynchronizationBlock,
} from '../../experimentRunner'
import { Message, MessageType, StopStatus } from '../../message'
import Node, { NodeRole } from '../../node'

export function handleFailure(this: Node, receivedMessage: Message): Message[] {
  // Only act when the node is in the tree
  // Send notification to nodes with a channel open
  const messages: Message[] = []

  if (this.id === 4071) {
    console.log('ok')
  }

  if (this.config.buildingBlocks.failureHandling === FailureHandlingBlock.Replace) {
    // Always replacing failed nodes except contributors
    if (this.role === NodeRole.LeafAggregator) {
      // A contributor failed
      // Remove the contributor from the children
      const childIndex = this.node!.children.findIndex(e => e.members.includes(receivedMessage.content.failedNode!))
      if (childIndex >= 0) {
        this.node!.children.splice(childIndex, 1)
      }

      // Send the aggregate if possible
      const contributors = this.node!.children.flatMap(e => e.members)
      const contributions = contributors.map(contributor => this.contributions[contributor]).filter(Boolean)
      if (contributors.length === 0) {
        this.manager.fullFailurePropagation(this)
        return []
      } else if (contributions.length === contributors.length) {
        messages.push(
          this.sendAggregate({
            counter: contributors.length,
            data: contributions.reduce((prev, curr) => prev + curr),
            id: this.aggregationId(contributors.map(String)),
          })
        )

        for (const member of this.node!.members) {
          messages.push(
            new Message(MessageType.ConfirmContributors, this.localTime, 0, this.id, member, {
              contributors,
            })
          )
        }
      }
    } else if (this.role === NodeRole.Backup) {
      // The node handling the failure is the replacement

      // Update the tree
      // Memory is shared across groups so it also updates parent and child groups
      this.node = receivedMessage.content.targetGroup!
      this.role = this.node.depth === 1 ? NodeRole.LeafAggregator : NodeRole.Aggregator
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
        messages.push(
          this.sendAggregate({
            counter: contributors.length,
            data: contributions.reduce((prev, curr) => prev + curr),
            id: this.aggregationId(contributors.map(String)),
          })
        )

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
    } else if (this.role === NodeRole.Backup) {
      // The node is a backup being inserted
      this.node = receivedMessage.content.targetGroup
      this.node!.members = this.node?.members.map(e => (e === receivedMessage.content.failedNode ? this.id : e))!
      this.node?.children.forEach(childGroup => (childGroup.parents = this.node!.members))
      this.role = this.node?.depth === 1 ? NodeRole.LeafAggregator : NodeRole.Aggregator

      // Ask child for their data
      const position = this.node?.members.indexOf(this.id)!
      if (this.config.buildingBlocks.standby === StandbyBlock.Stop) {
        // On Stop mode, propagate failure if any child finished working
        if (
          this.node!.children.flatMap(e => (e.depth === 0 ? e.members : e.members[position])).filter(
            e => this.manager.nodes[e].finishedWorking && this.manager.nodes[e].deathTime > this.manager.globalTime
          ).length > 0
        ) {
          // At least one of the child finished working
          if (this.config.buildingBlocks.failurePropagation === FailurePropagationBlock.FullFailurePropagation) {
            this.manager.fullFailurePropagation(this)
          } else {
            this.manager.localeFailurePropagation(this)
          }
        } else if (
          this.node!.children.flatMap(e => (e.depth === 0 ? e.members : e.members[position])).filter(
            e => this.manager.nodes[e].deathTime <= this.manager.globalTime
          ).length > 0
        ) {
          // One node is dead, add a timeout
          if (this.config.buildingBlocks.failurePropagation === FailurePropagationBlock.FullFailurePropagation) {
            this.manager.fullFailurePropagation(this, true)
          } else {
            this.manager.localeFailurePropagation(this, true)
          }
        }
      }
    } else {
      // An aggregator is handling the failure, the failure has already been propagated
      // Drop the failed group
      this.node!.children = this.node!.children.filter(e => !e.members.includes(receivedMessage.content.failedNode!))
      const position = this.node!.members.indexOf(this.id)
      const aggregates = this.node!.children.map(e => this.aggregates[e.members[position]]).filter(Boolean)
      // Send the aggregate if possible
      if (aggregates.length === this.node!.children.length && aggregates.length !== 0 && !this.finishedWorking) {
        // Full synchro waits for a contribution, else sends immeditaly
        if (this.config.buildingBlocks.synchronization === SynchronizationBlock.FullSynchronization) {
          this.confirmedChildren[this.id] = this.node!.children
          for (const member of this.node!.members.filter(e => this.id !== e)) {
            messages.push(
              new Message(MessageType.ConfirmChildren, this.localTime, 0, this.id, member, {
                children: this.node?.children,
              })
            )
          }
        } else {
          const aggregate = aggregates.reduce((prev, curr) => ({
            counter: prev.counter + curr.counter,
            data: prev.data + curr.data,
            id: this.aggregationId(aggregates.map(e => e.id)),
          }))
          messages.push(this.sendAggregate(aggregate))
        }
      } else if (this.node!.children.length === 0) {
        // The children lost its last children
        if (this.config.buildingBlocks.failurePropagation === FailurePropagationBlock.FullFailurePropagation) {
          this.manager.fullFailurePropagation(this)
        } else {
          if (this.role === NodeRole.Querier) {
            // The querier lost its only child, 0 data received
            messages.push(
              new Message(MessageType.StopSimulator, this.localTime, this.localTime, this.id, this.id, {
                status: StopStatus.Success,
                contributors: Array(0), // Trick to send the number of contributors
              })
            )
          } else {
            this.manager.localeFailurePropagation(this)
          }
        }
      }
    }
  }

  return messages
}
