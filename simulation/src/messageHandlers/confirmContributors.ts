import { arrayEquals, intersectLists } from '../helpers'
import { Message, MessageType } from '../message'
import { Node, NodeRole } from '../node'

export function handleConfirmContributors(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }

  // TODO: Set this in the backup contacting protocol
  this.role = NodeRole.LeafAggregator
  // Store the received list
  this.contributorsList[receivedMessage.emitterId] = receivedMessage.content.contributors

  const intersection = intersectLists(this.contributorsList[this.id], receivedMessage.content.contributors) || []

  if (!arrayEquals(this.contributorsList[this.id] || [], intersection)) {
    // Contributors have changed
    // Query previously unknown contributors for their data
    const newContributors = intersection.filter(
      (e) => !(this.contributorsList[this.id] || []).concat(this.queriedNode!).includes(e)
    )
    this.contributorsList[this.id] = intersection
    if (!this.queriedNode) {
      this.queriedNode = []
    }
    for (const contributor of newContributors) {
      // Memorize that we queried the node to prevent multiple queries
      this.queriedNode.push(contributor)
      messages.push(
        new Message(MessageType.RequestData, this.localTime, 0, this.id, contributor, { parents: this.node.members })
      )
    }

    if (this.finishedWorking) {
      // This node already finished aggregating but received updated contributors
      // It immediatly sends the updated aggregate to its parent
      this.lastSentAggregateId = this.aggregationId(this.contributorsList[this.id]!.map(String))
      messages.push(
        new Message(
          MessageType.SendAggregate,
          this.localTime,
          0, // Don't specify time to let the manager add the latency
          this.id,
          this.node.parents[this.node.members.indexOf(this.id)],
          {
            aggregate: {
              counter: this.contributorsList[this.id]!.length,
              data: this.contributorsList[this.id]!.map((e) => this.contributions[e]).reduce(
                (prev, curr) => prev + curr,
                0
              ),
              id: this.aggregationId(this.contributorsList[this.id]!.map(String)),
            },
          }
        )
      )
    }
  }

  if (
    !this.finishedWorking &&
    this.node.members.map((member) => this.contributorsList[member]).every(Boolean) &&
    this.contributorsList[this.id]?.map((e) => this.contributions[e]).every(Boolean)
  ) {
    // The node has received a list from each member and knows the contributions, send the aggregate
    this.lastSentAggregateId = this.aggregationId(this.contributorsList[this.id]!.map(String))
    messages.push(
      new Message(
        MessageType.SendAggregate,
        this.localTime,
        0, // Don't specify time to let the manager add the latency
        this.id,
        this.node.parents[this.node.members.indexOf(this.id)],
        {
          aggregate: {
            counter: this.contributorsList[this.id]!.length,
            data: this.contributorsList[this.id]!.map((e) => this.contributions[e]).reduce(
              (prev, curr) => prev + curr,
              0
            ),
            id: this.aggregationId(this.contributorsList[this.id]!.map(String)),
          },
        }
      )
    )
    this.finishedWorking = true
  }

  return messages
}
