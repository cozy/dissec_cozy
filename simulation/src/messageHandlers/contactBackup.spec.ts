import { NodeRole } from '../node'
import NodesManager from '../manager'
import { Message, MessageType } from '../message'
import TreeNode from '../treeNode'

describe('Contact backup', () => {
  const config = {
    averageLatency: 100,
    maxToAverageRatio: 10,
    averageCryptoTime: 100,
    averageComputeTime: 100,
    healthCheckPeriod: 3,
    multicastSize: 5,
    deadline: 100000,
    failureRate: 0.0004,
    depth: 3,
    fanout: 4,
    groupSize: 3,
    seed: '4-7'
  }

  let root: TreeNode
  let manager: NodesManager

  beforeEach(() => {
    const { node } = TreeNode.createTree(config.depth, config.fanout, config.groupSize, 0)
    root = node
    manager = NodesManager.createFromTree(root, config)
  })

  it('should respond positively if the backup is available', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    node.role = NodeRole.Backup
    node.contactedAsABackup = false

    let messages = node.receiveMessage(
      new Message(MessageType.ContactBackup, 0, receptionTime, node.id, node.id, { failedNode: 42 })
    )

    expect(messages.length).toBe(1)
    expect(messages[0].content.backupIsAvailable).toBe(true)
  })

  it('should ignore the message if the node is already contacted as a backup', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    node.role = NodeRole.Backup
    node.contactedAsABackup = true

    let messages = node.receiveMessage(
      new Message(MessageType.ContactBackup, 0, receptionTime, node.id, node.id, { failedNode: 42 })
    )

    expect(messages.length).toBe(1)
    expect(messages[0].content.backupIsAvailable).toBe(false)
  })

  it('should ignore the message if the node is not a backup', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    node.role = NodeRole.Aggregator
    node.contactedAsABackup = false

    let messages = node.receiveMessage(
      new Message(MessageType.ContactBackup, 0, receptionTime, node.id, node.id, { failedNode: 42 })
    )

    expect(messages.length).toBe(1)
    expect(messages[0].content.backupIsAvailable).toBe(false)
  })
})
