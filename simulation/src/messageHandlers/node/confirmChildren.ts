import { Message, MessageType } from '../../message'
import { Node } from '../../node'

export function handleConfirmChildren(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }
  if (!receivedMessage.content.children) {
    throw new Error('Empty contributors')
    // Empty contributors means we'll need to redo synchronization if it already started
    // this.confirmedChildren = {}
    // this.finishedWorking = false
    // return messages
  }

  // Store the received list
  const position = this.node.members.indexOf(this.id)

  // Send back a confirmation when first receiving from a node and all the data is received
  const expectedAggregates = this.node.children.map(childGroup => this.aggregates[childGroup.members[position]])
  if (!this.confirmedChildren[receivedMessage.emitterId] && expectedAggregates.every(Boolean)) {
    this.confirmedChildren[this.id] = this.node.children.filter(
      childGroup => this.aggregates[childGroup.members[position]]
    )
    for (const member of this.node.members.filter(e => this.id !== e)) {
      messages.push(
        new Message(MessageType.ConfirmChildren, this.localTime, 0, this.id, member, {
          children: this.confirmedChildren[this.id],
        })
      )
    }
  }

  this.confirmedChildren[receivedMessage.emitterId] = receivedMessage.content.children
  const children = this.node.members.map(e => this.confirmedChildren[e] as any)

  if (children.every(Boolean) && expectedAggregates.every(Boolean) && !this.finishedWorking) {
    // The node received a confirmation from all members and has received all expected aggregates
    // Compute the intersection of confirmations
    const intersection = this.intersectChildrenConfirmations()
    const aggregates = intersection.map(e => this.aggregates[e.members[position]])
    if (aggregates.length > 0) {
      const aggregate = aggregates.reduce((prev, curr) => ({
        counter: prev.counter + curr.counter,
        data: prev.data + curr.data,
        id: this.aggregationId(aggregates.map(e => e.id)),
      }))
      messages.push(...this.sendAggregate(aggregate))
    }
  }

  return messages
}
