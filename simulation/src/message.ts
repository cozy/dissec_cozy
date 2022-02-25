import { NodeRole } from './node'
import { Generator } from './random'
import TreeNode from './treeNode'

export enum MessageType {
  RequestContribution = "RequestContribution",
  SendContribution = "SendContribution",
  ContributionTimeout = "ContributionTimeout",
  // Synchronization
  ShareContributors = "ShareContributors",
  ConfirmContributors = "ConfirmContributors",
  SendAggregate = "SendAggregate",
  // Failure detection
  RequestHealthChecks = "RequestHealthChecks",
  CheckHealth = "CheckHealth",
  ConfirmHealth = "ConfirmHealth",
  HealthCheckTimeout = "HealthCheckTimeout",
  // Failure handling
  ContinueMulticast = "ContinueMulticast",
  ContactBackup = "ContactBackup",
  BackupResponse = "BackupResponse",
  ConfirmBackup = "ConfirmBackup",
  NotifyGroup = "NotifyGroup",
  SendChildren = "SendChildren",
  RequestData = "RequestData"
}

interface MessageContent {
  parents?: number[]
  share?: number
  contributors?: number[]
  aggregate?: { counter: number; data: number }
  failedNode?: number
  targetGroup?: TreeNode
  remainingBackups?: number[]
  backupIsAvailable?: boolean
  usedAsBackup?: boolean
  newMembers?: number[]
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
