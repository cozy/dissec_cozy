import { NodeRole } from "../node"
import NodesManager from "../manager"
import { Message, MessageType } from "../message"
import TreeNode from "../treeNode"
import { cloneDeep } from "lodash"

describe('Confirm backup', () => {
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

  it('should make the backup ask its group members for children', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const newRoot = cloneDeep(root)
    newRoot.members[0] = 3
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
        targetGroup: newRoot,
        failedNode: root.members[1]
      }
    ))

    expect(node.node?.children).toStrictEqual([])
    expect(node.role).toBe(NodeRole.Aggregator)
    expect(messages.length).toBe(config.groupSize - 1 + 1) // Members + timeout to self
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
