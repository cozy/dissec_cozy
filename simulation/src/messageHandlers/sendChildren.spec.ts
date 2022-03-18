import { NodeRole } from "../node"
import NodesManager from "../manager"
import { Message, MessageType } from "../message"
import TreeNode from "../treeNode"

describe('Send children', () => {
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

  it('should make a leaf aggregator with no known contributors update his and then request data', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const children = treenode.children
    const backupList = [42, 43, 46, 48]

    const node = manager.nodes[root.id]
    node.node!.children = []

    const messages = node.receiveMessage(new Message(
      MessageType.SendChildren,
      0,
      receptionTime,
      treenode.id,
      root.id,
      {
        children,
        role: NodeRole.LeafAggregator,
        backupList,
        contributors: backupList
      }
    ))

    expect(node.node!.children).toStrictEqual(children)
    expect(node.expectedContributors).toStrictEqual(backupList)
    expect(messages.length).toBe(backupList.length + 1)
  })

  it('should make an aggregator update his children and then request data', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const children = treenode.children
    const backupList = [42, 43, 46, 48]

    const node = manager.nodes[root.id]
    node.node!.children = []

    const messages = node.receiveMessage(new Message(
      MessageType.SendChildren,
      0,
      receptionTime,
      treenode.id,
      root.id,
      {
        children,
        role: NodeRole.LeafAggregator,
        backupList,
        contributors: backupList
      }
    ))

    expect(node.node!.children).toStrictEqual(children)
    expect(messages.length).toBe(children.length + 1)
  })

  it('should do nothing when the receiver already has children', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[root.id]
    const backupList = [42, 43, 46, 48]
    const childrenBefore = node.node!.children

    const messages = node.receiveMessage(new Message(
      MessageType.SendChildren,
      0,
      receptionTime,
      treenode.id,
      root.id,
      {
        children: treenode.children,
        role: NodeRole.LeafAggregator,
        backupList,
        contributors: backupList
      }
    ))

    expect(node.node!.children).toStrictEqual(childrenBefore)
    expect(messages.length).toBe(0)
  })

  it('should fail when the message has no children', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[root.id]
    node.node!.children = []
    const message = new Message(
      MessageType.SendChildren,
      0,
      receptionTime,
      treenode.id,
      root.id,
      {}
    )
    expect(() => node.receiveMessage(message)).toThrow()
  })
})
