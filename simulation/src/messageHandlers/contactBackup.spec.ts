import { NodeRole } from "../node"
import NodesManager from "../manager"
import { Message, MessageType } from "../message"
import TreeNode from "../treeNode"

describe('Contact backup', () => {
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

  it('should respond positively if the backup is available', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    node.role = NodeRole.Backup
    node.contactedAsABackup = false

    let messages = node.receiveMessage(new Message(
      MessageType.ContactBackup,
      0,
      receptionTime,
      node.id,
      node.id,
      { failedNode: 42 }
    ))

    expect(messages.length).toBe(1)
    expect(messages[0].content.backupIsAvailable).toBe(true)
  })

  it('should ignore the message if the node is already contacted as a backup', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    node.role = NodeRole.Backup
    node.contactedAsABackup = true

    let messages = node.receiveMessage(new Message(
      MessageType.ContactBackup,
      0,
      receptionTime,
      node.id,
      node.id,
      { failedNode: 42 }
    ))

    expect(messages.length).toBe(1)
    expect(messages[0].content.backupIsAvailable).toBe(false)
  })

  it('should ignore the message if the node is not a backup', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    node.role = NodeRole.Aggregator
    node.contactedAsABackup = false

    let messages = node.receiveMessage(new Message(
      MessageType.ContactBackup,
      0,
      receptionTime,
      node.id,
      node.id,
      { failedNode: 42 }
    ))

    expect(messages.length).toBe(1)
    expect(messages[0].content.backupIsAvailable).toBe(false)
  })
})
