import { Message } from '../message'
import { Node } from '../node'

export function handleShareContributors(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (
    !receivedMessage.content.contributors ||
    receivedMessage.content.contributors.length === 0
  ) {
    throw new Error(
      'Received an empty contributors list, the protocol should stop'
    )
  }

  // TODO: Receiving enough contributors list should trigger the timeout
  this.contributorsList[receivedMessage.emitterId] = receivedMessage.content.contributors

  return messages
}
