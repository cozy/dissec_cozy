import { NodeRole } from "../node"
import NodesManager from "../manager"
import { Message, MessageType } from "../message"
import TreeNode from "../treeNode"

describe('Backup response', () => {
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

  it('should send a confirmation to the backup if the node is still looking for one', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    const failedNode = node.node?.children[0].members[0]
    node.role = NodeRole.Backup
    node.continueMulticast = true
    node.lookingForBackup[failedNode!] = true

    const messages = node.receiveMessage(new Message(
      MessageType.BackupResponse,
      0,
      receptionTime,
      treenode.id,
      root.id,
      {
        backupIsAvailable: true,
        failedNode
      }
    ))

    expect(node.lookingForBackup[failedNode!]).toBe(false)
    expect(node.continueMulticast).toBe(false)
    expect(messages.length).toBe(1)
    expect(messages[0].content.useAsBackup).toBe(true)
  })

  it('should refuse when the node already found a backup', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    node.role = NodeRole.Backup
    node.continueMulticast = true

    let messages = node.receiveMessage(new Message(
      MessageType.BackupResponse,
      0,
      receptionTime,
      treenode.id,
      root.id,
      {
        backupIsAvailable: false,
        failedNode: node.node?.children[0].members[0]
      }
    ))

    expect(messages.length).toBe(1)
    expect(messages[0].content.useAsBackup).toBe(false)

    node.continueMulticast = false

    messages = node.receiveMessage(new Message(
      MessageType.BackupResponse,
      0,
      receptionTime,
      treenode.id,
      root.id,
      {
        backupIsAvailable: true,
        failedNode: node.node?.children[0].members[0]
      }
    ))

    expect(messages.length).toBe(1)
    expect(messages[0].content.useAsBackup).toBe(false)
  })

  it('should fail when the node is not given a target group to join', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    node.role = NodeRole.Backup

    expect(() => node.receiveMessage(new Message(
      MessageType.BackupResponse,
      0,
      receptionTime,
      root.id,
      treenode.id,
      { backupIsAvailable: true }
    ))).toThrow()
  })

  it('should fail when the backup does not know the tree', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    node.role = NodeRole.Backup
    node.node = undefined

    expect(() => node.receiveMessage(new Message(
      MessageType.BackupResponse,
      0,
      receptionTime,
      root.id,
      treenode.id,
      { backupIsAvailable: true, failedNode: 19 }
    ))).toThrow()
  })
})
