import NodesManager from '../manager'
import { Message, MessageType } from '../message'
import TreeNode from '../treeNode'

describe('Health check timeout', () => {
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

  it('should trigger backup search for each failed node', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    node.backupList = Array(20)
      .fill(0)
      .map((_, i) => i)

    const toCheck = { 10: true, 20: true }
    node.ongoingHealthChecks = JSON.parse(JSON.stringify(toCheck))

    const messages = node.receiveMessage(
      new Message(MessageType.HealthCheckTimeout, 0, receptionTime, node.id, node.id, {})
    )

    expect(messages.length).toBe(Object.values(toCheck).length * (config.multicastSize + 1))
  })

  it('should do nothing if the node has no ongoing checks', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]

    const messages = node.receiveMessage(
      new Message(MessageType.HealthCheckTimeout, 0, receptionTime, node.id, node.id, {})
    )

    expect(messages.length).toBe(0)
  })

  it('should fail when the node does not know the tree', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const message = new Message(MessageType.HealthCheckTimeout, 0, receptionTime, root.id, treenode.id, {})
    const node = manager.nodes[treenode.id]
    node.node = undefined
    expect(() => node.receiveMessage(message)).toThrow()
  })
})
