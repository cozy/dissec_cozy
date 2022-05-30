import { Message, MessageType } from '../message'
import { Node } from '../node'

export function handleContributorsPolling(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }

  const receivedContributions =
    this.contributorsList[this.id]?.map(contributor => this.contributions[contributor]) || []

  if (!receivedContributions.every(Boolean)) {
    // The timeout triggered and some contributions are still missing
    throw new Error(`Node #${this.id} timed out waiting for contributors confirmation and is missing contributions`)
  }

  if (!this.finishedWorking) {
    // Send the aggregate
    messages.push(
      new Message(
        MessageType.SendAggregate,
        this.localTime,
        0,
        this.id,
        this.node.parents[this.node.members.indexOf(this.id)],
        {
          aggregate: {
            counter: this.contributorsList[this.id]!.length,
            data: this.contributorsList[this.id]!.map(contributor => this.contributions[contributor]).reduce(
              (prev, curr) => prev + curr
            ),
            id: this.aggregationId(this.contributorsList[this.id]!.map(String)),
          },
        }
      )
    )
  }

  return messages
}
