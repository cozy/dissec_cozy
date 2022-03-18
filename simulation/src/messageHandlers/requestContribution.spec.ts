import NodesManager, { AVERAGE_COMPUTE, AVERAGE_CRYPTO } from "../manager"
import { Message, MessageType } from "../message"
import { NodeRole } from "../node"
import TreeNode from "../treeNode"

describe('Request contribution', () => {
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

  it('should compute shares and send them to all parents', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const message = new Message(
      MessageType.RequestContribution,
      0,
      receptionTime,
      root.id,
      treenode.id,
      { parents: manager.nodes[root.id].node!.members }
    )
    const node = manager.nodes[treenode.id]
    const messages = node.receiveMessage(message)

    expect(node.role).toBe(NodeRole.Contributor)
    expect(node.localTime).toBe(receptionTime + AVERAGE_COMPUTE + groupSize * AVERAGE_CRYPTO)
    expect(node.shares.length).toBe(groupSize)
    expect(node.shares.reduce((prev, curr) => prev + curr)).toBe(node.secretValue * groupSize)
    expect(messages.length).toBe(groupSize)
    for (let i = 0; i < groupSize; i++) {
      expect(messages[i].content.share).toBe(node.shares[i])
    }
  })

  it('should fail when the node does not know the tree', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const message = new Message(
      MessageType.RequestContribution,
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

  it('should fail when the node is not given parents', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const message = new Message(
      MessageType.RequestContribution,
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
