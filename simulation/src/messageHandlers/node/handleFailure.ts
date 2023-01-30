import {
  FailureHandlingBlock,
  FailurePropagationBlock,
  StandbyBlock,
  SynchronizationBlock,
} from '../../experimentRunner'
import { arrayEquals, intersectLists } from '../../helpers'
import { Message, MessageType, StopStatus } from '../../message'
import Node, { NodeRole } from '../../node'

export function handleFailure(this: Node, receivedMessage: Message): Message[] {
  // Only act when the node is in the tree
  // Send notification to nodes with a channel open
  const messages: Message[] = []

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
        // No contributors left
        this.manager.propagateFailure(this, false)
        return []
      } else if (contributions.length === contributors.length) {
        // Received all contributions
        if (
          [SynchronizationBlock.FullSynchronization, SynchronizationBlock.LeavesSynchronization].includes(
            this.config.buildingBlocks.synchronization
          )
        ) {
          // Reset confirmations
          this.contributorsList = { [this.id]: contributors }
        }
        const intersectedList = this.node!.members.map(member => this.contributorsList[member]).reduce((a, b) =>
          intersectLists(a, b)
        )

        // The leaf aggregator received all expected data
        // It may resend the updated data
        if (
          (this.config.buildingBlocks.standby !== StandbyBlock.Stop &&
            [SynchronizationBlock.NonBlocking, SynchronizationBlock.None].includes(
              this.config.buildingBlocks.synchronization
            )) ||
          ([SynchronizationBlock.FullSynchronization, SynchronizationBlock.LeavesSynchronization].includes(
            this.config.buildingBlocks.synchronization
          ) &&
            arrayEquals(this.contributorsList[this.id] || [], intersectedList || []))
        ) {
          messages.push(
            ...this.sendAggregate({
              counter: contributors.length,
              data: contributions.reduce((prev, curr) => prev + curr),
              id: this.aggregationId(contributors.map(String)),
            })
          )
        }

        if (this.config.buildingBlocks.synchronization !== SynchronizationBlock.None) {
          for (const member of this.node!.members) {
            messages.push(
              new Message(MessageType.ConfirmContributors, this.localTime, 0, this.id, member, {
                contributors,
              })
            )
          }
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
      this.contributorsList[this.id] = this.node.children.flatMap(e => e.members)

      if (this.config.buildingBlocks.synchronization === SynchronizationBlock.FullSynchronization) {
        // Members of the parent group are informed that children changed
        for (const parent of this.node.parents) {
          this.manager.nodes[parent].confirmedChildren = {}
          // messages.push(
          //   new Message(MessageType.ConfirmChildren, this.localTime, 0, this.node.parents[position], parent, {})
          // )
        }
      }

      const msg = (child: number) =>
        new Message(
          MessageType.RequestData,
          this.localTime,
          this.localTime + this.config.averageLatency,
          this.id,
          child,
          {}
        )

      if (
        this.config.buildingBlocks.standby === StandbyBlock.NoResync &&
        this.node.depth <= this.config.buildingBlocks.resyncLevel
      ) {
        // The failure happened below the threshold depth
        this.manager.abortedReplacements += 1
        this.manager.propagateFailure(this, false)
      } else if (this.node.depth === 1) {
        // Asking contributors
        // Reasking leaves
        for (const child of this.node.children.flatMap(e => e.members)) {
          messages.push(msg(child))
        }
      } else {
        // Asking aggregators
        for (const child of this.node.children.map(e => e.members[position])) {
          const timeout = 2 * this.config.averageLatency * this.config.maxToAverageRatio
          if (this.manager.nodes[child]?.isAlive(this.localTime + timeout)) {
            // Request data from living child
            messages.push(msg(child))
          } else {
            // The child is dead and may have failed while no one could handle it, handle it now
            messages.push(new Message(MessageType.Failing, this.localTime, this.localTime, child, child, {}))
          }
        }
      }
    } else {
      // Aggregators handling failures means the below subtree was cut off
      // Drop the failed group
      this.node!.children = this.node!.children.filter(e => !e.members.includes(receivedMessage.content.failedNode!))
      this.node!.children.forEach(childGroup => (childGroup.parents = this.node!.members))
      // Update each members knowledge of children
      this.node!.members.forEach(member => (this.manager.nodes[member].node!.children = this.node!.children))
      // Update each child knowledge of parents
      this.node!.children.flatMap(e => e.members).forEach(
        child => (this.manager.nodes[child].node!.parents = this.node!.members)
      )

      // Resetting confirmations
      const position = this.node!.members.indexOf(this.id)
      const aggregates = this.node!.children.map(e => this.aggregates[e.members[position]]).filter(Boolean)
      this.confirmedChildren[this.id] = this.node!.children.filter(e => this.aggregates[e.members[position]])
      // Send the aggregate if possible
      if (aggregates.length === this.node!.children.length && aggregates.length !== 0) {
        // Received all aggregates
        const aggregate = aggregates.reduce((prev, curr) => ({
          counter: prev.counter + curr.counter,
          data: prev.data + curr.data,
          id: this.aggregationId(aggregates.map(e => e.id)),
        }))
        messages.push(...this.sendAggregate(aggregate))
      } else if (this.node?.children.length === 0) {
        if (this.id !== this.manager.querier) {
          // Ran out of children, cut the tree from here
          this.manager.propagateFailure(this, false)
        } else {
          messages.push(
            new Message(MessageType.StopSimulator, this.localTime, this.localTime, this.id, this.id, {
              status: StopStatus.Success,
              contributors: Array(0),
            })
          )
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
      if (
        (!this.finishedWorking ||
          (this.finishedWorking &&
            [SynchronizationBlock.NonBlocking].includes(this.config.buildingBlocks.synchronization))) &&
        contributors.length === contributions.length &&
        contributions.length > 0
      ) {
        // Ready to send the aggregate
        if (
          [SynchronizationBlock.FullSynchronization, SynchronizationBlock.LeavesSynchronization].includes(
            this.config.buildingBlocks.synchronization
          )
        ) {
          messages.push(
            ...this.sendAggregate({
              counter: contributors.length,
              data: contributions.reduce((prev, curr) => prev + curr),
              id: this.aggregationId(contributors.map(String)),
            })
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
    } else if (this.role === NodeRole.Backup) {
      // The node is a backup being inserted
      this.node = receivedMessage.content.targetGroup
      this.node!.members = this.node?.members.map(e => (e === receivedMessage.content.failedNode ? this.id : e))!
      this.node?.children.forEach(childGroup => (childGroup.parents = this.node!.members))
      this.role = this.node?.depth === 1 ? NodeRole.LeafAggregator : NodeRole.Aggregator

      // Ask child for their data
      const position = this.node?.members.indexOf(this.id)!
      if ([StandbyBlock.Stop, StandbyBlock.NoResync].includes(this.config.buildingBlocks.standby)) {
        // On Stop mode, propagate failure if any child finished working
        // If not, reask data from the ones alive
        if (
          this.node!.children.flatMap(e => (e.depth === 0 ? e.members : e.members[position])).filter(
            e => this.manager.nodes[e].finishedWorking && this.manager.nodes[e].isAlive(this.manager.globalTime)
          ).length > 0
        ) {
          // At least one of the child finished working
          this.manager.abortedReplacements += 1
          this.manager.propagateFailure(this, false)
        } else if (
          this.node!.children.flatMap(e => (e.depth === 0 ? e.members : e.members[position])).filter(
            e => !this.manager.nodes[e].isAlive(this.manager.globalTime)
          ).length > 0
        ) {
          // One node is dead, add a timeout
          this.manager.abortedReplacements += 1
          this.manager.propagateFailure(this, true)
        }
      } else {
        // On Stay mode, request data from all alive children
        const children =
          this.role === NodeRole.LeafAggregator
            ? this.node!.children.map(e => e.members[0])
            : this.node!.children.map(e => e.members[position])
        if (children.length > 0 && this.node!.depth > 2) {
          children.map(child => {
            const timeout = 2 * this.config.averageLatency * this.config.maxToAverageRatio
            if (this.manager.nodes[child].isAlive(this.localTime + timeout)) {
              messages.push(new Message(MessageType.RequestData, this.localTime, 0, this.id, child, {}))
            } else {
              this.manager.propagateFailure(this.manager.nodes[child], false)
            }
          })
        } else {
          // Ran out of nodes to request
          this.manager.abortedReplacements += 1
          this.manager.propagateFailure(this, false)
        }
      }
    } else {
      // An aggregator is handling the failure, the failure has already been propagated
      // Drop the failed group
      this.node!.children = this.node!.children.filter(e => !e.members.includes(receivedMessage.content.failedNode!))
      this.node!.children.forEach(childGroup => (childGroup.parents = this.node!.members))
      // Update each members knowledge of children
      this.node!.members.forEach(member => (this.manager.nodes[member].node!.children = this.node!.children))
      // Update each child knowledge of parents
      this.node!.children.flatMap(e => e.members).forEach(
        child => (this.manager.nodes[child].node!.parents = this.node!.members)
      )

      // Resetting confirmations
      const position = this.node!.members.indexOf(this.id)
      const aggregates = this.node!.children.map(e => this.aggregates[e.members[position]]).filter(Boolean)
      this.confirmedChildren[this.id] = this.node!.children.filter(e => this.aggregates[e.members[position]])
      // Send the aggregate if possible
      if (
        aggregates.length === this.node!.children.length &&
        aggregates.length !== 0 &&
        ((!this.finishedWorking && this.config.buildingBlocks.standby === StandbyBlock.Stop) || StandbyBlock.Stay)
      ) {
        // Received all aggregates
        // Full synchro waits for a contribution, else sends immeditaly
        if (this.config.buildingBlocks.synchronization === SynchronizationBlock.FullSynchronization) {
          for (const member of this.node!.members.filter(e => this.id !== e)) {
            messages.push(
              new Message(MessageType.ConfirmChildren, this.localTime, 0, this.id, member, {
                children: this.confirmedChildren[this.id],
              })
            )
          }
        } else {
          const aggregate = aggregates.reduce((prev, curr) => ({
            counter: prev.counter + curr.counter,
            data: prev.data + curr.data,
            id: this.aggregationId(aggregates.map(e => e.id)),
          }))
          messages.push(...this.sendAggregate(aggregate))
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
