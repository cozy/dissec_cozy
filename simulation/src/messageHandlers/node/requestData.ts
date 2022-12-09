import { Message, MessageType } from '../../message'
import { Node, NodeRole } from '../../node'

export function handleRequestData(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }

  if (this.role === NodeRole.Contributor) {
    // Verifying the parent's certificate, signature and open an encrypted channel
    this.localTime += 3 * this.cryptoLatency()
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
    if (!this.finishedWorking || !this.contributorsList[this.id]) {
      // The node has not finished receiving contributions, it will answer later
      return messages
    }

    // Verifying the parent's certificate, signature and open an encrypted channel
    this.localTime += 3 * this.cryptoLatency()

    this.lastSentAggregateId = this.aggregationId(this.contributorsList[this.id]!.map(String))
    const transmissionTime = (this.config.modelSize - 1) * this.config.averageLatency
    this.finishedWorking = true
    messages.push(
      new Message(
        MessageType.PrepareSendAggregate,
        this.localTime,
        this.localTime + transmissionTime,
        this.id,
        this.id,
        {
          aggregate: {
            counter: this.contributorsList[this.id]!.length,
            data: this.contributorsList[this.id]!.map(e => this.contributions[e]).reduce((prev, curr) => prev + curr),
            id: this.aggregationId(this.contributorsList[this.id]!.map(String)),
          },
          targetNode: receivedMessage.emitterId,
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

    // Verifying the parent's certificate, signature and open an encrypted channel
    this.localTime += 3 * this.cryptoLatency()

    const aggregationId = this.aggregationId(children.map(child => this.aggregates[child].id))
    const transmissionTime = (this.config.modelSize - 1) * this.config.averageLatency
    this.lastSentAggregateId = aggregationId
    this.finishedWorking = true
    messages.push(
      new Message(
        MessageType.PrepareSendAggregate,
        this.localTime,
        this.localTime + transmissionTime, // ASAP
        this.id,
        this.id,
        {
          aggregate: children
            .map(child => this.aggregates[child])
            .reduce((prev, curr) => ({
              counter: prev.counter + curr.counter,
              data: prev.data + curr.data,
              id: aggregationId,
            })),
          targetNode: receivedMessage.emitterId,
        }
      )
    )
  }

  return messages
}
