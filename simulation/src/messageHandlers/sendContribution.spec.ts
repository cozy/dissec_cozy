import NodesManager from '../manager'
import { Message, MessageType } from '../message'
import TreeNode from '../treeNode'

describe('Send contribution', () => {
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

  it('should add the contribution to the nodes buffer', async () => {
    const receptionTime = 10
    const shareValue = 42
    const treenode = root.children[0]
    const node = manager.nodes[root.id]

    node.receiveMessage(
      new Message(MessageType.SendContribution, 0, receptionTime, treenode.id, root.id, { share: shareValue })
    )

    expect(node.contributorsList[node.id]).toStrictEqual([treenode.id])
    expect(node.contributions[treenode.id]).toBe(shareValue)
  })

  it('should forward the aggregate when all expected contributions are received', async () => {
    const shareValue = 42
    const treenode = root.children[0]
    const node = manager.nodes[root.id]

    node.expectedContributors = treenode.members

    const result: Message[] = []
    Array(config.groupSize)
      .fill(0)
      .map((_, i) =>
        result.push(
          ...node.receiveMessage(
            new Message(MessageType.SendContribution, 0, node.localTime, treenode.members[i], root.id, {
              share: shareValue
            })
          )
        )
      )

    expect(result.length).toBe(1)
  })

  it('should fail when the node does not know the tree', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const message = new Message(MessageType.SendContribution, 0, receptionTime, root.id, treenode.id, { share: 10 })
    const node = manager.nodes[treenode.id]
    node.node = undefined
    expect(() => node.receiveMessage(message)).toThrow()
  })

  it('should fail when the node is not given a share', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const message = new Message(MessageType.SendContribution, 0, receptionTime, root.id, treenode.id, {})
    const node = manager.nodes[treenode.id]
    expect(() => node.receiveMessage(message)).toThrow()
  })
})
