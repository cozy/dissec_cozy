import NodesManager from '../manager'
import Message, { MessageType } from '../message'
import TreeNode from '../treeNode'

describe('Share contributors', () => {
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

  it('should add contributors to the buffer', async () => {
    const receptionTime = 10
    const contributors = [42]
    const treenode = root.children[0]
    const node = manager.nodes[root.id]

    node.receiveMessage(
      new Message(MessageType.ShareContributors, 0, receptionTime, treenode.id, root.id, { contributors })
    )

    expect(node.contributorsList[treenode.id]).toStrictEqual(contributors)
  })

  it('should fail when the node does not receive contributors', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const message = new Message(MessageType.ShareContributors, 0, receptionTime, root.id, treenode.id, {})
    const node = manager.nodes[treenode.id]
    expect(() => node.receiveMessage(message)).toThrow()
  })
})
