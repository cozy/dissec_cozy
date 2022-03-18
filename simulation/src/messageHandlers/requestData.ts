import { Node, NodeRole } from "../node"
import { Message, MessageType } from "../message"

export function handleRequestData(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  if (!receivedMessage.content.parents) throw new Error(`${this.id} did not receive parents`)

  // The child updates his parents
  this.node.parents = receivedMessage.content.parents

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
            )
          }
        }
      )
    )
  } else {
    const position = this.node.members.indexOf(this.id)
    const children = this.node.children.map(child => child.members[position])

    // Do not send data if they have not yet been received
    // Occurs when the node is a backup that has not yet received data from its children
    if (children.map(child => this.aggregates[child]).some(e => !e))
      return messages

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
            data: prev.data + curr.data
          }))
        }
      )
    )
  }

  return messages
}
