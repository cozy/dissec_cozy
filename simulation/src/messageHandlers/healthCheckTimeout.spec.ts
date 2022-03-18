import NodesManager, { MULTICAST_SIZE } from "../manager"
import { Message, MessageType } from "../message"
import TreeNode from "../treeNode"

describe('Health check timeout', () => {
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

  it('should trigger backup search for each failed node', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    node.backupList = Array(20).fill(0).map((_, i) => i)

    const toCheck = [10, 20]
    node.ongoingHealthChecks = toCheck

    const messages = node.receiveMessage(new Message(
      MessageType.HealthCheckTimeout,
      0,
      receptionTime,
      node.id,
      node.id,
      {}
    ))

    expect(messages.length).toBe(toCheck.length * (MULTICAST_SIZE + 1))
  })

  it('should do nothing if the node has no ongoing checks', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]

    const messages = node.receiveMessage(new Message(
      MessageType.HealthCheckTimeout,
      0,
      receptionTime,
      node.id,
      node.id,
      {}
    ))

    expect(messages.length).toBe(0)
  })

  it('should fail when the node does not know the tree', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const message = new Message(
      MessageType.HealthCheckTimeout,
      0,
      receptionTime,
      root.id,
      treenode.id,
      {}
    )
    const node = manager.nodes[treenode.id]
    node.node = undefined
    expect(() => node.receiveMessage(message)).toThrow()
  })
})
