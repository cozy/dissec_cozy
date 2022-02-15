import NodesManager, { MAX_LATENCY } from './manager'
import { Message, MessageType } from './message'
import TreeNode from './treeNode'

const depth = 1
const fanout = 4
const groupSize = 3

const { node: root } = TreeNode.createTree(depth, fanout, groupSize, 0)
root.log()

const manager = NodesManager.createFromTree(root)

// All leaves aggregator request data from contributors
const leavesAggregators = root.selectNodesByDepth(depth - 1)
for (const aggregator of leavesAggregators) {
  // Requesting contributions
  for (const child of aggregator.children.flatMap(e => e.members)) {
    // Only the node with the lowest ID sends the message
    manager.transmitMessage(
      new Message(MessageType.RequestContribution, 0, 0, aggregator.id, child, {
        parents: aggregator.members
      })
    )
  }

  // Setting timeouts on the aggregators
  for (const member of aggregator.members) {
    // TODO: Timeouts should take into account the broadcasts.
    // Currently supposes that contributors are reached in 1 hop
    if (member === aggregator.id) {
      // The first member of the group also waits for the rest of the group
      // Hence the additional latency
      manager.transmitMessage(
        new Message(
          MessageType.ContributionTimeout,
          0,
          3 * MAX_LATENCY,
          aggregator.id,
          aggregator.id,
          {}
        )
      )
    } else {
      manager.transmitMessage(
        new Message(
          MessageType.ContributionTimeout,
          0,
          2 * MAX_LATENCY,
          member,
          member,
          {}
        )
      )
    }
  }
}

while (manager.messages.length > 0) {
  manager.handleNextMessage()
}
