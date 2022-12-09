import { FailureHandlingBlock, FailurePropagationBlock, StandbyBlock } from '../../experimentRunner'
import NodesManager from '../../manager'
import { Message, MessageType, StopStatus } from '../../message'
import { NodeRole } from '../../node'

export function handleFailing(this: NodesManager, receivedMessage: Message) {
  const node = this.nodes[receivedMessage.emitterId]
  node.localTime = this.globalTime

  if (this.config.debug) {
    console.log(`${node.tag()} failed`)
  }

  const getReplacement = (minDeathTime: number) => {
    // Find a live replacement
    let replacement = this.replacementNodes.pop()!
    while ((replacement?.deathTime || -1) < Math.max(minDeathTime, this.globalTime)) {
      if (this.replacementNodes.length === 0) break
      replacement = this.replacementNodes.pop()!
    }
    if (!replacement) {
      throw new Error('Out of backup')
    }
    replacement.localTime = this.globalTime
    return replacement
  }

  if (node.node) {
    // Only act when the node is in the tree
    // Send notification to nodes with a channel open
    const messages: Message[] = []

    if (
      this.config.buildingBlocks.standby === StandbyBlock.Stay &&
      this.config.buildingBlocks.failureHandling === FailureHandlingBlock.Replace &&
      node.role !== NodeRole.Contributor
    ) {
      // Always replacing failed nodes except contributors

      // Timeout + ask + confirm + open secure channels
      const replacementLatency =
        this.config.averageLatency * (2 * this.config.maxToAverageRatio + 4) + this.config.averageCryptoTime * 6
      const replacement = getReplacement(this.globalTime + replacementLatency)
      messages.push(
        new Message(
          MessageType.HandleFailure,
          this.globalTime + replacementLatency,
          this.globalTime + replacementLatency,
          replacement.id,
          replacement.id,
          {
            targetGroup: node.node,
            failedNode: receivedMessage.emitterId,
          }
        )
      )
    } else if (this.config.buildingBlocks.failureHandling === FailureHandlingBlock.Drop) {
      const position = node.node.members.indexOf(node.id)!
      // When dropping, we stop replacing nodesas soon as they have done their work or if they're contribubtors
      if (node.finishedWorking) {
        if (
          this.nodes[node.node.parents[position]].finishedWorking ||
          this.nodes[node.node.parents[position]].contributions[node.id]
        ) {
          // Ignore failures when the parent is also done working or has received the share
        } else if (node.role === NodeRole.Contributor) {
          // The node is a contributor failing during the transmission of tis shares
          // Parents will notice the transmission's interruption and will discard the contributions
          const latency = 2 * this.config.averageLatency * this.config.maxToAverageRatio
          for (const parent of node.node.parents) {
            messages.push(
              new Message(MessageType.HandleFailure, this.globalTime, this.globalTime + latency, node.id, parent, {
                targetGroup: node.node,
                failedNode: receivedMessage.emitterId,
              })
            )
          }
        } else {
          // Propagate the failure of nodes who died before contributing
          if (this.config.buildingBlocks.failurePropagation === FailurePropagationBlock.FullFailurePropagation) {
            // TODO: Count incurred comms
            const timeout = 2 * this.config.averageLatency * this.config.maxToAverageRatio
            const propagationLatency = (2 * this.config.depth - node.node.depth) * this.config.averageLatency
            messages.push(
              new Message(
                MessageType.StopSimulator,
                this.globalTime,
                this.globalTime + timeout + propagationLatency,
                node.id,
                node.id,
                {
                  status: StopStatus.FullFailurePropagation,
                  failedNode: node.id,
                }
              )
            )

            // Set all nodes as dead
            Object.values(this.nodes).forEach(node => (node.deathTime = this.globalTime + timeout + propagationLatency))
          }
        }
      } else {
        if (node.role === NodeRole.Contributor) {
          // Can't replace contributors, even if they didn't work
          // Notify parents of the failure of a contributor when the parent is not done
          if (!this.nodes[node.node.parents[position]].finishedWorking && !node.finishedWorking) {
            // One of the parent did not finish aggregating.
            // Notify all parents that a contributor will be missing
            const latency = 2 * this.config.averageLatency * this.config.maxToAverageRatio
            for (const parent of node.node.parents) {
              messages.push(
                new Message(MessageType.HandleFailure, this.globalTime, this.globalTime + latency, node.id, parent, {
                  targetGroup: node.node,
                  failedNode: receivedMessage.emitterId,
                })
              )
            }
          }
        } else {
          // Replace the node
          // Timeout + ask + confirm + open secure channels
          const replacementLatency =
            this.config.averageLatency * (2 * this.config.maxToAverageRatio + 4) + this.config.averageCryptoTime * 6
          const replacement = getReplacement(this.globalTime + replacementLatency)
          messages.push(
            new Message(
              MessageType.HandleFailure,
              this.globalTime + replacementLatency,
              this.globalTime + replacementLatency,
              replacement.id,
              replacement.id,
              {
                targetGroup: node.node,
                failedNode: receivedMessage.emitterId,
              }
            )
          )
        }
      }
    }

    messages.forEach(m => this.insertMessage(m))
  }
}
