import { Generator } from './random'

export enum MessageType {
  RequestContribution,
  SendContribution,
  ContributionTimeout,
  ShareContributors,
  ConfirmContributors,
  SendAggregate
}

interface MessageContent {
  parents?: number[]
  share?: number
  contributors?: number[]
  aggregate?: { counter: number; data: number }
}

export class Message {
  id: number
  type: MessageType
  emissionTime: number
  receptionTime: number
  emitterId: number
  receiverId: number
  content: MessageContent

  constructor(
    type: MessageType,
    emissionTime: number,
    receptionTime: number,
    emitterId: number,
    receiverId: number,
    content: MessageContent
  ) {
    this.id = Generator.get()()
    this.type = type
    this.emissionTime = emissionTime
    this.receptionTime = receptionTime
    this.emitterId = emitterId
    this.receiverId = receiverId
    this.content = content
  }
}
