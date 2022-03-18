import { NodeRole } from "../node"
import NodesManager from "../manager"
import { Message, MessageType } from "../message"
import TreeNode from "../treeNode"

describe('Request data', () => {
  const depth = 3
  const fanout = 4
  const groupSize = 3

  let root: TreeNode
  let manager: NodesManager

  beforeEach(() => {
    const { node } = TreeNode.createTree(depth, fanout, groupSize, 0)
    root = node
    manager = NodesManager.createFromTree(root)
  })

  it('should make contributors send the corresponding share', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    node.role = NodeRole.Contributor
    node.shares = [1, 2, 3]

    const messages = node.receiveMessage(new Message(
      MessageType.RequestData,
      0,
      receptionTime,
      root.id,
      treenode.id,
      { parents: manager.nodes[root.id].node!.members }
    ))

    expect(messages.length).toBe(1)
    expect(messages[0].content.share).toBe(1)
  })

  it('should make leaf aggregators send their aggregate to the corresponding parent', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    node.role = NodeRole.LeafAggregator
    node.contributorsList = { [node.id]: [84] }
    node.contributions = { [84]: 42 }

    const messages = node.receiveMessage(new Message(
      MessageType.RequestData,
      0,
      receptionTime,
      root.id,
      treenode.id,
      { parents: manager.nodes[root.id].node!.members }
    ))

    expect(messages.length).toBe(1)
    expect(messages[0].receiverId).toBe(node.node!.parents[0])
    expect(messages[0].content.aggregate).toStrictEqual({ counter: 1, data: 42 })
  })

  it('should fail when the node does not know the tree', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const message = new Message(
      MessageType.RequestData,
      0,
      receptionTime,
      root.id,
      treenode.id,
      { parents: manager.nodes[root.id].node!.members }
    )
    const node = manager.nodes[treenode.id]
    node.node = undefined
    expect(() => node.receiveMessage(message)).toThrow()
  })

  it('should fail when the node does not receive parents', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const message = new Message(
      MessageType.RequestData,
      0,
      receptionTime,
      root.id,
      treenode.id,
      {}
    )
    const node = manager.nodes[treenode.id]
    expect(() => node.receiveMessage(message)).toThrow()
  })
})
