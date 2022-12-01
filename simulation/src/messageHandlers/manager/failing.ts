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

      // Find a live replacement
      let replacement = this.replacementNodes.pop()!
      while ((replacement?.deathTime || -1) < this.globalTime) {
        if (this.replacementNodes.length === 0) break
        replacement = this.replacementNodes.pop()!
      }
      if (!replacement) {
        throw new Error('Out of backup')
      }
      replacement.localTime = this.globalTime

      // TODO: Account for messages and crypto
      const replacementLatency = 2 * this.config.averageLatency * this.config.maxToAverageRatio
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
      // When dropping, ignore contributors failures
      if (node.role !== NodeRole.Contributor && !node.finishedWorking) {
        // Propagate the failure of nodes who died before contributing
        if (this.config.buildingBlocks.failurePropagation === FailurePropagationBlock.FullFailurePropagation) {
          // TODO: Count incurred comms
          const propagationLatency = (2 * this.config.depth - node.node.depth) * this.config.averageLatency
          this.globalTime += propagationLatency
          messages.push(
            new Message(MessageType.StopSimulator, this.globalTime, this.globalTime, node.id, node.id, {
              status: StopStatus.FullFailurePropagation,
              failedNode: node.id,
            })
          )

          // Set all nodes as dead
          Object.values(this.nodes).forEach(node => (node.deathTime = this.globalTime))
        } else {
          throw new Error('Not implemented')
        }
      }
    }

    messages.forEach(m => this.insertMessage(m))
  }
}
