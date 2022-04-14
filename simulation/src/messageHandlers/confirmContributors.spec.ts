import NodesManager from "../manager"
import { Message, MessageType } from "../message"
import TreeNode from "../treeNode"

describe('Confirm contributors', () => {
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

  it('should forward the aggregate if the node is the first member and has received contributors lists', async () => {
    const receptionTime = 10
    const finalContributors = [5]
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    node.contributions = {
      1: 50,
      2: 60,
      3: 70,
      4: 80
    }
    node.contributorsList = {
      [node.id]: [1, 2, 3, 4],
      [node.node!.members[1]]: [1, 2, 3],
      [node.node!.members[2]]: [1, 2, 3, 4]
    }

    const messages = node.receiveMessage(new Message(
      MessageType.ConfirmContributors,
      0,
      receptionTime,
      node.id,
      node.id,
      { contributors: finalContributors }
    ))

    expect(node.contributorsList[node.id]).toStrictEqual(finalContributors)
    expect(messages.length).toBe(1)
    expect(messages[0].type).toBe(MessageType.SendAggregate)
  })

  it('should fail when the node does not receive contributors', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const message = new Message(
      MessageType.ConfirmContributors,
      0,
      receptionTime,
      root.id,
      treenode.id,
      {}
    )
    const node = manager.nodes[treenode.id]
    expect(() => node.receiveMessage(message)).toThrow()
  })

  it('should fail when the node does not know the tree', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const message = new Message(
      MessageType.ConfirmContributors,
      0,
      receptionTime,
      root.id,
      treenode.id,
      { contributors: [1] }
    )
    const node = manager.nodes[treenode.id]
    node.node = undefined
    expect(() => node.receiveMessage(message)).toThrow()
  })
})
