import NodesManager from "../manager"
import { Message, MessageType } from "../message"
import TreeNode from "../treeNode"

describe('Contribution timeout', () => {
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

  it('should forward the aggregate if the node is the first member and has received contributors lists', async () => {
    const receptionTime = 10
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
      MessageType.ContributionTimeout,
      0,
      receptionTime,
      node.id,
      node.id,
      {}
    ))

    expect(node.contributorsList[node.id]).toStrictEqual([1, 2, 3])
    expect(messages.length).toBe(groupSize)
    expect(messages.map(e => e.receiverId)).toStrictEqual(node.node?.members.filter(e => e !== node.id).concat([root.id]))
    expect(messages[groupSize - 1].content.aggregate?.data).toStrictEqual(180)
  })

  it('should send the contributors list to the first member when the node is not the first member itself', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    node.node = TreeNode.fromCopy(node.node!, node.node!.members[1])
    node.id = node.node!.members[1]
    node.contributions = {
      1: 50,
      2: 60,
      3: 70,
      4: 80
    }
    node.contributorsList = { [node.id]: [1, 2, 3, 4] }

    const messages = node.receiveMessage(new Message(
      MessageType.ContributionTimeout,
      0,
      receptionTime,
      node.id,
      node.id,
      {}
    ))

    expect(messages.length).toBe(2)
    expect(node.contributorsList[node.id]).toStrictEqual([1, 2, 3, 4])
  })

  it('should do nothing if the node has received all expected contributions', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[treenode.id]
    node.contributions = {
      1: 50,
      2: 60,
      3: 70,
      4: 80
    }
    node.contributorsList = { [node.id]: [1, 2, 3, 4] }
    node.expectedContributors = [1, 2, 3, 4]

    const messages = node.receiveMessage(new Message(
      MessageType.ContributionTimeout,
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
      MessageType.ContributionTimeout,
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
