import { FailureHandlingBlock, SynchronizationBlock } from '../../experimentRunner'
import NodesManager from '../../manager'
import { Message, MessageType } from '../../message'
import { NodeRole } from '../../node'

export function handleFailing(this: NodesManager, receivedMessage: Message) {
  const node = this.nodes[receivedMessage.emitterId]
  node.localTime = this.globalTime
  node.propagatedFailure = true

  if (this.config.debug) {
    console.log(`${node.tag()} failed`)
  }

  const getReplacement = (minDeathTime: number) => {
    // Find a live replacement
    let replacement = this.replacementNodes.pop()!
    while (!replacement?.isAlive(Math.max(minDeathTime, this.globalTime))) {
      if (this.replacementNodes.length === 0) break
      replacement = this.replacementNodes.pop()!
    }
    if (!replacement) {
      this.propagateFailure(node, false)
      // this.fullFailurePropagation(node)
      return
    }
    replacement.localTime = this.globalTime
    return replacement
  }

  if (node.node) {
    // Only act when the node is in the tree
    // Send notification to nodes with a channel open
    const messages: Message[] = []

    if (
      this.config.buildingBlocks.synchronization === SynchronizationBlock.NonBlocking &&
      node.role === NodeRole.Contributor &&
      node.finishedWorking
    ) {
      // A contributor is failing after it finished working but we're doing non blocking synchronization
      // In this mode, contributor's failures always trigger resends
      // Alert parents of the contributor
      const latency = 2 * this.config.averageLatency * this.config.maxToAverageRatio
      for (const parent of node.node.parents) {
        messages.push(
          new Message(MessageType.HandleFailure, this.globalTime + latency, this.globalTime + latency, parent, parent, {
            targetGroup: node.node,
            failedNode: receivedMessage.emitterId,
          })
        )
      }
    } else if (this.config.buildingBlocks.failureHandling === FailureHandlingBlock.Replace) {
      // Always replacing failed nodes except contributors
      if (node.role !== NodeRole.Contributor) {
        // Timeout + ask + confirm + open secure channels
        const replacementLatency =
          this.config.averageLatency * (2 * this.config.maxToAverageRatio + 4) + this.config.averageCryptoTime * 6
        const replacement = getReplacement(this.globalTime + replacementLatency)
        if (!replacement) return

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
      } else {
        // Alert parents of the contributor
        const latency = 2 * this.config.averageLatency * this.config.maxToAverageRatio
        for (const parent of node.node.parents) {
          messages.push(
            new Message(
              MessageType.HandleFailure,
              this.globalTime + latency,
              this.globalTime + latency,
              parent,
              parent,
              {
                targetGroup: node.node,
                failedNode: receivedMessage.emitterId,
              }
            )
          )
        }
      }
    } else {
      const position = node.node.members.indexOf(node.id)!
      const parent = this.nodes[node.node.parents[position]]
      // When dropping, we stop replacing nodes as soon as they have done their work or if they're contributors
      if (node.finishedWorking) {
        if (parent.finishedWorking || parent.contributions[node.id]) {
          // Ignore failures when the parent is also done working or has received the share
        } else if (node.role === NodeRole.Contributor) {
          // The node is a contributor failing during the transmission of his shares
          // Parents will notice the transmission's interruption and will discard the contributions
          const latency = 2 * this.config.averageLatency * this.config.maxToAverageRatio
          for (const parent of node.node.parents) {
            messages.push(
              new Message(MessageType.HandleFailure, this.globalTime, this.globalTime + latency, node.id, parent, {
                targetGroup: node.node,
                failedNode: node.id,
              })
            )
          }
        } else {
          // Propagate the failure of nodes who died before contributing
          this.propagateFailure(node, true)
        }
      } else {
        if (node.role === NodeRole.Contributor) {
          // Can't replace contributors, even if they didn't work
          // Notify parents of the failure of a contributor when the parent is not done
          if (!parent.finishedWorking && !node.finishedWorking) {
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
          // If the node can't be replaced, the replacement node will propagate the failure itself
          // Timeout + ask + confirm + open secure channels
          const replacementLatency =
            this.config.averageLatency * (2 * this.config.maxToAverageRatio + 4) + this.config.averageCryptoTime * 6
          const replacement = getReplacement(this.globalTime + replacementLatency)
          if (!replacement) return

          messages.push(
            new Message(
              MessageType.HandleFailure,
              this.globalTime + replacementLatency,
              this.globalTime + replacementLatency,
              replacement.id,
              replacement.id,
              {
                targetGroup: node.node,
                failedNode: node.id,
              }
            )
          )
        }
      }
    }

    messages.forEach(m => this.insertMessage(m))
  }
}
