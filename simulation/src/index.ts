import NodesManager from './manager'
import { Message, MessageType } from './message'
import TreeNode from './treeNode'

const depth = 2
const fanout = 4
const groupSize = 3

const { node: root } = TreeNode.createTree(depth, fanout, groupSize, 0)
root.log()

const manager = NodesManager.createFromTree(root)

// All leaves aggregator request data from contributors
const leavesAggregators = root.selectNodesByDepth(depth - 1)
for (const aggregator of leavesAggregators) {
  for (const child of aggregator.children.flatMap(e => e.members)) {
    // Only the node with the lowest ID sends the message
    manager.transmitMessage(
      new Message(MessageType.RequestContribution, 0, 0, aggregator.id, child, {
        parents: aggregator.members
      })
    )
  }
}

while(manager.messages.length > 0) {
  manager.handleNextMessage()
}
