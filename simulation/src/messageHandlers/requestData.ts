import { Message, MessageType } from '../message'
import { arrayEquals, Node, NodeRole } from '../node'

export function handleRequestData(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }
  if (!receivedMessage.content.parents) {
    throw new Error(`${this.id} did not receive parents`)
  }

  // The child updates his parents
  if (!arrayEquals(this.node.parents, receivedMessage.content.parents)) {
    // The parent group has been updated since the last time
    this.node.parents = receivedMessage.content.parents
  }

  if (this.role === NodeRole.Contributor) {
    messages.push(
      new Message(
        MessageType.SendContribution,
        this.localTime,
        0, // ASAP
        this.id,
        receivedMessage.emitterId,
        { share: this.shares[this.node.parents.indexOf(receivedMessage.emitterId)] }
      )
    )
  } else if (this.role === NodeRole.LeafAggregator) {
    messages.push(
      new Message(
        MessageType.SendAggregate,
        this.localTime,
        0, // ASAP
        this.id,
        receivedMessage.emitterId,
        {
          aggregate: {
            counter: this.contributorsList[this.id].length,
            data: this.contributorsList[this.id].map(e => this.contributions[e]).reduce(
              (prev, curr) => prev + curr
            ),
            id: this.aggregationId(this.contributorsList[this.id].map(String))
          },
        }
      )
    )
  } else {
    const position = this.node.members.indexOf(this.id)
    const children = this.node.children.map(child => child.members[position])

    // Do not send data if they have not yet been received
    // Occurs when the node is a backup that has not yet received data from its children
    if (children.length === 0 || children.map(child => this.aggregates[child]).some(e => !e)) {
      return messages
    }

    const aggregationId = this.aggregationId(children.map(child => this.aggregates[child].id))
    messages.push(
      new Message(
        MessageType.SendAggregate,
        this.localTime,
        0, // ASAP
        this.id,
        receivedMessage.emitterId,
        {
          aggregate: children.map(child => this.aggregates[child]).reduce((prev, curr) => ({
            counter: prev.counter + curr.counter,
            data: prev.data + curr.data,
            id: aggregationId
          })),
        }
      )
    )
  }

  return messages
}
