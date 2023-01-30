import { arrayEquals } from './helpers'
import Node, { NodeRole } from './node'
import { Generator } from './random'
import TreeNode from './treeNode'

export enum MessageType {
  // System
  StopSimulator = 'STOP',
  Failing = 'Failing',
  // Contribution
  RequestContribution = 'ReqContrib',
  FinishContribution = 'FinishContrib',
  StartSendingContribution = 'StartSendContrib',
  SendContribution = 'SendContrib',
  // Synchronization
  ConfirmContributors = 'ConfContrib',
  ConfirmChildren = 'ConfChildren',
  SynchronizationTimeout = 'SynchroTO',
  FinishSendingAggregate = 'FinishAgg',
  SendAggregate = 'SendAgg',
  // Failure detection
  HandleFailure = 'Failure',
  // Failure handling
  NotifyGroup = 'NotifGroup',
  NotifyGroupTimeout = 'NotifGroupTO',
  ContributorsPolling = 'ContributorsPolling',
  SendChildren = 'SendChildren',
  RequestData = 'ReqData',
  GiveUpChild = 'GiveUp',
}

export const isSystemMessage = (messageType: MessageType) => {
  switch (messageType) {
    case MessageType.StopSimulator:
      return true
    case MessageType.Failing:
      return true
    default:
      return false
  }
}

export enum StopStatus {
  Unfinished = 'Unfinished',
  Success = 'Success',
  GroupDead = 'GroupDead',
  SimultaneousFailures = 'SimulFails',
  ExceededDeadline = 'Deadline',
  BadResult = 'BadResult',
  AllContributorsDead = 'ContribDead',
  OutOfBackup = '0Backup',
  FullFailurePropagation = 'FFP',
}

export interface Aggregate {
  counter: number
  data: number
  id: string
}

export interface MessageContent {
  status?: StopStatus
  targetNode?: number
  parents?: number[]
  members?: number[]
  share?: number
  contributors?: number[]
  aggregate?: Aggregate
  parentLastReceivedAggregateId?: string
  failedNode?: number
  targetGroup?: TreeNode
  remainingBackups?: number[]
  backupIsAvailable?: boolean
  backupList?: number[]
  useAsBackup?: boolean
  role?: NodeRole
  children?: TreeNode[]
}

export class Message {
  id: number
  type: MessageType
  emissionTime: number
  receptionTime: number
  emitterId: number
  receiverId: number
  content: MessageContent
  delivered: boolean = false
  work: number = 0

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

  log(receiver: Node, filter: MessageType[] = []) {
    if (filter.includes(this.type)) return

    const tag = receiver.tag()
    const position = receiver.node?.members.indexOf(receiver.id)
    let children: number[] =
      receiver.role === NodeRole.Querier
        ? receiver.node?.children.length === 0
          ? []
          : receiver.node?.children[0].members
        : (receiver.node?.children
            .map(e => (position ? e.members[position] : undefined))
            .filter(e => e !== undefined) as any)

    switch (receiver.role) {
      case NodeRole.Querier:
        children = receiver.node!.children.length === 0 ? [] : receiver.node!.children[0].members
        break
      case NodeRole.LeafAggregator:
        children = receiver.node!.children.flatMap(e => e.members)
        break
      case NodeRole.Backup:
        children = []
        break
      default:
        children = receiver.node!.children.map(e => e.members[position!])
        break
    }

    switch (this.type) {
      case MessageType.RequestContribution:
        console.log(`${tag} received a request for contribution`)
        break
      case MessageType.FinishContribution:
        console.log(`${tag} is sending the last packet to its parents`)
        break
      case MessageType.StartSendingContribution:
        console.log(`${tag} starts sending its contribution`)
        break
      case MessageType.SendContribution:
        console.log(
          `${tag} received contribution n°${Object.values(receiver.contributions).length + 1} (${
            this.content.share
          }) from #${this.emitterId}`
        )
        break
      case MessageType.ConfirmContributors:
        console.log(
          `${tag} received a${
            arrayEquals(receiver.contributorsList[receiver.id] || [], this.content.contributors || [])
              ? ''
              : ' different'
          } confirmed list of ${this.content.contributors?.length} contributors from node #${this.emitterId}, ${
            receiver.contributorsList[receiver.id]?.every(e => receiver.contributions[e]) ? '' : 'not '
          }sending data to parent #${receiver.node?.parents[receiver.node?.members.indexOf(receiver.id)] || '???'}. ${
            this.content.contributors
              ? `new id=${receiver.aggregationId(this.content.contributors.map(String))}`
              : 'Did not receive contributors'
          }`
        )
        break
      case MessageType.ConfirmChildren:
        console.log(
          `${tag} received a list of ${this.content.children?.length} children from node #${
            this.emitterId
          }, already received [${receiver
            .node!.members.filter(e => receiver.confirmedChildren[e])
            .map(e => '#' + e)
            .join(', ')}]`
        )
        break
      case MessageType.SynchronizationTimeout:
        const contributors = receiver.contributorsList[receiver.id] || []
        console.log(
          `${tag} timed out waiting for confirmations of contributors and is missing ${
            contributors.length - contributors.map(e => receiver.contributions[e]).filter(Boolean).length
          } contributors`
        )
        break
      case MessageType.FinishSendingAggregate:
        console.log(
          `${tag} finished sending its aggregate (ID=${this.content.aggregate?.id}) to parent #${this.content.targetNode}`
        )
        break
      case MessageType.SendAggregate:
        console.log(
          `${tag} received an aggregate from child #${this.emitterId} (ID=${this.content.aggregate!.id}). [${children
            ?.filter(child => Boolean(receiver.aggregates[child]))
            .map(e => '#' + e)}] out of [${children.map(e => `#${e}(${receiver.aggregates[e]?.id || '??'})`)}]`
        )
        break
      case MessageType.HandleFailure:
        console.log(
          `${tag} is handling the failure of node #${this.content.failedNode} (${
            receiver.manager.nodes[this.content.failedNode!].role
          })`
        )
        break
      case MessageType.NotifyGroup:
        console.log(
          `${tag} has been contacted by the new member #${this.emitterId} to know its children, replacing #${
            this.content.failedNode
          } in group [${this.content.targetGroup?.members.map(e => '#' + e)}]${
            receiver.contributorsList[receiver.id] || receiver.node?.children.length
              ? '.'
              : ', but does not know child yet.'
          }`
        )
        break
      case MessageType.NotifyGroupTimeout:
        console.log(
          `${tag} has timed out on the group notification. ${
            receiver.node?.children.length
              ? `New children are [${receiver.node?.children.map(e => '#' + e.members[position!])}]`
              : 'No known children'
          }`
        )
        break
      case MessageType.ContributorsPolling:
        console.log(
          `${tag} has timed out on the group notification. New children are [${receiver.node?.children.map(
            e => e.members[position!]
          )}] ${!receiver.node?.children.length ? 'No known children' : 'Ignored'}`
        )
        break
      case MessageType.SendChildren:
        console.log(
          `${tag} received its children from node #${this.emitterId}: [${this.content.children?.map(
            e => '#' + e.members
          )}]`
        )
        break
      case MessageType.RequestData:
        console.log(`${tag} has been requested data by backup #${this.emitterId} joining the tree`)
        break
      case MessageType.GiveUpChild:
        console.log(`${tag} has been told to give up child ${this.content.targetNode} by member ${this.emitterId}`)
        break
    }
  }
}

export default Message
