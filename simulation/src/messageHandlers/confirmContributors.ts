import { Node } from "../node"
import { Message, MessageType } from "../message"

export function handleConfirmContributors(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  if (
    !receivedMessage.content.contributors ||
    receivedMessage.content.contributors.length === 0
  )
    throw new Error(
      'Received an empty contributors list, the protocol should stop'
    )

  this.contributorsList[this.id] = receivedMessage.content.contributors

  messages.push(
    new Message(
      MessageType.SendAggregate,
      this.localTime,
      0, // Don't specify time to let the manager add the latency
      this.id,
      this.node.parents[this.node.members.indexOf(this.id)],
      {
        aggregate: {
          counter: this.contributorsList[this.id].length,
          data: Object.values(this.contributions).reduce(
            (prev, curr) => prev + curr,
            0
          )
        }
      }
    )
  )

  return messages
}
