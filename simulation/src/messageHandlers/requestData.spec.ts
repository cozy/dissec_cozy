import { NodeRole } from '../node'
import NodesManager from '../manager'
import { Message, MessageType } from '../message'
import TreeNode from '../treeNode'

describe('Request data', () => {
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

  it('should make contributors send the corresponding share', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    node.role = NodeRole.Contributor
    node.shares = [1, 2, 3]

    const messages = node.receiveMessage(
      new Message(MessageType.RequestData, 0, receptionTime, root.id, treenode.id, {
        parents: manager.nodes[root.id].node!.members
      })
    )

    expect(messages.length).toBe(1)
    expect(messages[0].content.share).toBe(1)
  })

  it('should make leaf aggregators not send anything unless they have the final contributors list', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    node.role = NodeRole.LeafAggregator
    node.contributorsList = { [node.id]: [84] }
    node.contributions = { [84]: 42 }

    let messages = node.receiveMessage(
      new Message(MessageType.RequestData, 0, receptionTime, root.id, treenode.id, {
        parents: manager.nodes[root.id].node!.members
      })
    )

    expect(messages.length).toBe(0)

    node.finishedWorking = true

    messages = node.receiveMessage(
      new Message(MessageType.RequestData, 0, receptionTime, root.id, treenode.id, {
        parents: manager.nodes[root.id].node!.members
      })
    )

    expect(messages.length).toBe(1)
    expect(messages[0].receiverId).toBe(node.node!.parents[0])
    expect(messages[0].content.aggregate).toStrictEqual({
      counter: 1,
      data: 42,
      id: node.aggregationId(node.contributorsList[node.id].map(String))
    })
  })

  it('should fail when the node does not know the tree', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const message = new Message(MessageType.RequestData, 0, receptionTime, root.id, treenode.id, {
      parents: manager.nodes[root.id].node!.members
    })
    const node = manager.nodes[treenode.id]
    node.node = undefined
    expect(() => node.receiveMessage(message)).toThrow()
  })

  it('should fail when the node does not receive parents', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const message = new Message(MessageType.RequestData, 0, receptionTime, root.id, treenode.id, {})
    const node = manager.nodes[treenode.id]
    expect(() => node.receiveMessage(message)).toThrow()
  })
})
