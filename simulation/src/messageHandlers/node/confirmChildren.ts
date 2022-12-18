import { Message } from '../../message'
import { Node } from '../../node'
import TreeNode from '../../treeNode'

export function handleConfirmChildren(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }
  if (!receivedMessage.content.children) {
    // Empty contributors
    return messages
  }

  // Store the received list
  this.confirmedChildren[receivedMessage.emitterId] = receivedMessage.content.children

  const intersect = (lists: TreeNode[][]) => {
    let result: TreeNode[] = []
    // TODO: Make it better
    const shortestList = lists.find(list => list.length === Math.min(...lists.map(e => e.length)))!
    for (const element of shortestList) {
      // Checking if each element of the shortest list is included in EVERY other list
      let occurrences = 0
      for (const list of lists) {
        if (list === shortestList) {
          // Do not intersect the list with itself
          continue
        }

        let missing = true
        for (const other of list) {
          if (element.equals(other)) {
            // The element is in the other list
            missing = false
            break
          }
        }

        if (!missing) {
          occurrences += 1
        }
      }
      if (occurrences === lists.length - 1) {
        // The element is in every list
        result.push(element)
      }
    }
    return result
  }
  const children = this.node.members.map(e => this.confirmedChildren[e] as any)

  if (!children.includes(undefined) && !this.finishedWorking) {
    // All members have the same share
    const intersection = intersect(children)
    const position = this.node.members.indexOf(this.id)
    const aggregates = intersection.map(e => this.aggregates[e.members[position]])
    const aggregate = aggregates.reduce((prev, curr) => ({
      counter: prev.counter + curr.counter,
      data: prev.data + curr.data,
      id: this.aggregationId(aggregates.map(e => e.id)),
    }))
    messages.push(this.sendAggregate(aggregate))
  }

  return messages
}
