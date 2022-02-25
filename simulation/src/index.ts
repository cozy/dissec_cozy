import NodesManager, { MAX_LATENCY } from './manager'
import { Message, MessageType } from './message'
import Node, { NodeRole } from './node'
import TreeNode from './treeNode'

const depth = 4
const fanout = 4
const groupSize = 3
const backupListSize = 10

const { nextId, node: root } = TreeNode.createTree(depth, fanout, groupSize, 0)
root.log()

// Adding the querier group
const querierGroup = new TreeNode(nextId)
querierGroup.children.push(root)
querierGroup.members = Array(groupSize).fill(nextId)
root.parents = querierGroup.members

const manager = NodesManager.createFromTree(root)
const n = manager.addNode(querierGroup)
n.role = NodeRole.Querier

// Set a single failure to study how it evolves
manager.nodes[6].alive = false // First node of a group on the second level

// Create a backup list and give it to all the nodes
const backupListStart = manager.nodes.length
const backups = []
for (let i = 0; i < backupListSize; i++) {
  const backup = new Node({ id: backupListStart + i })
  manager.nodes.push(new Node({ id: backupListStart + i }))
  backups.push(backup)
}
for(let i=0; i<backupListStart; i++) {
  manager.nodes[i].backupList = backups.map(e => e.id)
}

// All leaves aggregator request data from contributors
const leavesAggregators = root.selectNodesByDepth(depth - 1)
for (const aggregator of leavesAggregators) {
  for(const member of aggregator.members) {
    manager.nodes[member].role = NodeRole.LeafAggregator
  }
  // Requesting contributions
  for (const child of aggregator.children.flatMap(e => e.members)) {
    // Only the node with the lowest ID sends the message
    manager.transmitMessage(
      new Message(MessageType.RequestContribution, 0, 0, aggregator.id, child, {
        parents: aggregator.members
      })
    )
  }

  // Setting contribution collection timeouts on the leaves aggregators
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

// Upper layers periodically send health checks to their children
for (let i = 0; i < depth; i++) {
  const nodes = querierGroup.selectNodesByDepth(i)
  for (const node of nodes) {
    for (const member of node.members) {
      manager.transmitMessage(
        new Message(MessageType.RequestHealthChecks, 0, 0, member, member, {})
      )
    }
  }
}

while (manager.messages.length > 0) {
  manager.handleNextMessage()
}

console.log(
  `${manager.nodes.filter(node => node.alive).length}/ ${
    manager.nodes.length
  } (${(manager.nodes.filter(node => node.alive).length /
    manager.nodes.length) *
    100}%) of nodes are still alive`
)

console.log(`A total of ${manager.messageCounter} have been sent`)
