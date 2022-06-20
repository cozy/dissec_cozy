import NodesManager from '../manager'
import { Message, MessageType } from '../message'
import { NodeRole } from '../node'
import TreeNode from '../treeNode'

describe('Request contribution', () => {
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
    seed: '4-7',
  }

  let root: TreeNode
  let manager: NodesManager

  beforeEach(() => {
    const { node } = TreeNode.createTree(config.depth, config.fanout, config.groupSize, 0)
    root = node
    manager = NodesManager.createFromTree(root, config)
  })

  it('should compute shares and send them to all parents', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const message = new Message(MessageType.RequestContribution, 0, receptionTime, root.id, treenode.id, {
      parents: manager.nodes[root.id].node!.members,
    })
    const node = manager.nodes[treenode.id]
    const messages = node.receiveMessage(message)

    expect(node.role).toBe(NodeRole.Contributor)
    expect(node.localTime).toBe(
      receptionTime + config.averageComputeTime + (config.groupSize + 2) * node.cryptoLatency()
    )
    expect(node.shares.length).toBe(config.groupSize)
    expect(node.shares.reduce((prev, curr) => prev + curr)).toBe(node.secretValue * config.groupSize)
    expect(messages.length).toBe(config.groupSize)
    for (let i = 0; i < config.groupSize; i++) {
      expect(messages[i].content.share).toBe(node.shares[i])
    }
  })

  it('should fail when the node does not know the tree', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const message = new Message(MessageType.RequestContribution, 0, receptionTime, root.id, treenode.id, {
      parents: manager.nodes[root.id].node!.members,
    })
    const node = manager.nodes[treenode.id]
    node.node = undefined
    expect(() => node.receiveMessage(message)).toThrow()
  })

  it('should fail when the node is not given parents', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const message = new Message(MessageType.RequestContribution, 0, receptionTime, root.id, treenode.id, {})
    const node = manager.nodes[treenode.id]
    expect(() => node.receiveMessage(message)).toThrow()
  })
})
