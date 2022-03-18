import { NodeRole } from "../node"
import NodesManager from "../manager"
import { Message, MessageType } from "../message"
import TreeNode from "../treeNode"

describe('Confirm backup', () => {
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

  it('should make the backup ask its group members for children', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    node.role = NodeRole.Backup

    const messages = node.receiveMessage(new Message(
      MessageType.ConfirmBackup,
      0,
      receptionTime,
      treenode.id,
      root.id,
      {
        useAsBackup: true,
        targetGroup: root,
        failedNode: root.members[1]
      }
    ))

    expect(node.node?.children).toStrictEqual([])
    expect(node.role).toBe(NodeRole.Aggregator)
    expect(messages.length).toBe(groupSize - 1)
  })

  it('should fail when the backup is not given a target group to join', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    node.role = NodeRole.Backup

    expect(() => node.receiveMessage(new Message(
      MessageType.ConfirmBackup,
      0,
      receptionTime,
      root.id,
      treenode.id,
      {
        useAsBackup: true,
        failedNode: root.members[1]
      }
    ))).toThrow()

    expect(() => node.receiveMessage(new Message(
      MessageType.ConfirmBackup,
      0,
      receptionTime,
      root.id,
      treenode.id,
      {
        useAsBackup: true,
        targetGroup: root
      }
    ))).toThrow()
  })
})
