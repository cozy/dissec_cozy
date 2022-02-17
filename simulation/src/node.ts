import {
  AVERAGE_COMPUTE,
  AVERAGE_CRYPTO,
  HEALTH_CHECK_PERIOD,
  MAX_LATENCY
} from './manager'
import { Message, MessageType } from './message'
import { Generator } from './random'
import TreeNode from './treeNode'

const BASE_NOISE = 10000000

class Node {
  id: number
  node: TreeNode
  localTime: number
  alive: boolean
  ongoingHealthChecks: number[]
  finishedWorking: boolean
  shares: number[]
  contributorsList: number[][]
  contributions: { [contributor: string]: number }
  aggregates: { counter: number; data: number }[]
  isQuerier: boolean

  constructor(node: TreeNode) {
    this.id = node.id
    this.node = node
    this.localTime = 0
    this.alive = true
    this.ongoingHealthChecks = []
    this.finishedWorking = false
    this.contributorsList = [[]]
    this.contributions = {}
    this.aggregates = []
    this.isQuerier = false
  }

  receiveMessage(receivedMessage: Message): Message[] {
    const messages: Message[] = []
    const position = this.node.members.indexOf(this.id)

    this.localTime = Math.max(this.localTime, receivedMessage.receptionTime)

    switch (receivedMessage.type) {
      case MessageType.RequestContribution:
        console.log(
          `Node #${this.id} (time=${
            this.localTime
          }) received a request for contribution`
        )

        // Prepare shares
        this.localTime += AVERAGE_COMPUTE
        // TODO: Better value, not always 50
        this.shares = Array(this.node.members.length).fill(0)
        let accumulator = 0
        const generator = Generator.get()
        for (let i = 0; i < this.node.members.length - 1; i++) {
          this.shares[i] = BASE_NOISE * generator()
          accumulator += this.shares[i]
        }
        this.shares[this.shares.length - 1] = 50 - accumulator

        for (const parent of receivedMessage.content.parents || []) {
          // Open a secure channel
          this.localTime += AVERAGE_CRYPTO

          // Send data to parent
          messages.push(
            new Message(
              MessageType.SendContribution,
              this.localTime,
              0, // Don't specify time to let the manager add the latency
              this.id,
              parent,
              { share: this.shares[this.node.parents.indexOf(parent)] }
            )
          )
        }
        break
      case MessageType.SendContribution:
        console.log(
          `Node #${this.id} (time=${this.localTime}) received a contribution (${
            receivedMessage.content.share
          })`
        )

        if (!receivedMessage.content.share)
          throw new Error('Received a contribution without a share')

        this.contributorsList[0].push(receivedMessage.emitterId) // The first item is the local list
        this.contributions[receivedMessage.emitterId] =
          receivedMessage.content.share
        break
      case MessageType.ContributionTimeout:
        console.log(
          `Node #${this.id} (time=${
            this.localTime
          }) timed out waiting for contributions`
        )

        if (this.id === this.node.members[0]) {
          // The leader aggregates the received contributors lists and confirms them to the group
          const finalContributors = []
          for (const contributor of this.contributorsList[0]) {
            // Checking that a given contributor is in every contributors lists
            if (
              this.contributorsList
                .map(list => list.includes(contributor))
                .every(val => val)
            ) {
              finalContributors.push(contributor)
            }
          }
          this.contributorsList[0] = finalContributors

          for (const member of this.node.members.filter(e => e !== this.id)) {
            messages.push(
              new Message(
                MessageType.ConfirmContributors,
                this.localTime,
                0, // Don't specify time to let the manager add the latency
                this.id,
                member,
                { contributors: finalContributors }
              )
            )
          }

          messages.push(
            new Message(
              MessageType.SendAggregate,
              this.localTime,
              0, // Don't specify time to let the manager add the latency
              this.id,
              this.node.parents[this.node.members.indexOf(this.id)],
              {
                aggregate: {
                  counter: this.contributorsList[0].length,
                  data: Object.values(this.contributions).reduce(
                    (prev, curr) => prev + curr
                  )
                }
              }
            )
          )
        } else {
          // Group members send their contributors list to the first member
          messages.push(
            new Message(
              MessageType.ShareContributors,
              this.localTime,
              0, // Don't specify time to let the manager add the latency
              this.id,
              this.node.members[0],
              { contributors: this.contributorsList[0] }
            )
          )
        }
        break
      case MessageType.ShareContributors:
        console.log(
          `Node #${this.id} (time=${
            this.localTime
          }) received contributors from member node #${
            receivedMessage.emitterId
          }:\n${receivedMessage.content.contributors}`
        )

        if (
          !receivedMessage.content.contributors ||
          receivedMessage.content.contributors.length === 0
        )
          throw new Error(
            'Received an empty contributors list, the protocol should stop'
          )

        // TODO: Receiving enough contributors list should trigger the timeout
        this.contributorsList.push(receivedMessage.content.contributors)
        break
      case MessageType.ConfirmContributors:
        console.log(
          `Node #${this.id} (time=${
            this.localTime
          }) received a confirmation of the final contributors list from member node #${
            receivedMessage.emitterId
          }`
        )

        if (
          !receivedMessage.content.contributors ||
          receivedMessage.content.contributors.length === 0
        )
          throw new Error(
            'Received an empty contributors list, the protocol should stop'
          )

        this.contributorsList[0] = receivedMessage.content.contributors

        messages.push(
          new Message(
            MessageType.SendAggregate,
            this.localTime,
            0, // Don't specify time to let the manager add the latency
            this.id,
            this.node.parents[this.node.members.indexOf(this.id)],
            {
              aggregate: {
                counter: this.contributorsList[0].length,
                data: Object.values(this.contributions).reduce(
                  (prev, curr) => prev + curr
                )
              }
            }
          )
        )
        break
      case MessageType.SendAggregate:
        console.log(
          `${this.isQuerier ? 'Querier' : 'Node'} #${this.id} (time=${
            this.localTime
          }) received an aggregate from child #${receivedMessage.emitterId}`
        )

        if (this.isQuerier) {
          if (!receivedMessage.content.aggregate)
            throw new Error('Received an empty aggregate')

          this.aggregates.push(receivedMessage.content.aggregate)

          if (this.aggregates.length === this.node.members.length) {
            // Received all shares
            const result = this.aggregates.reduce((prev, curr) => ({
              counter: prev.counter + curr.counter,
              data: prev.data + curr.data
            }))
            console.log(
              `Final aggregation result: ${
                result.counter
              } contributions -> ${(result.data / result.counter) *
                this.aggregates.length}`
            )
          }
        } else {
          if (!receivedMessage.content.aggregate)
            throw new Error('Received an empty aggregate')

          this.aggregates.push(receivedMessage.content.aggregate)

          if (this.aggregates.length === this.node.children.length) {
            // Forwarding the result to the parent
            const aggregate = this.aggregates.reduce((prev, curr) => ({
              counter: prev.counter + curr.counter,
              data: prev.data + curr.data
            }))

            // Stop regularly checking children's health
            this.finishedWorking = true

            messages.push(
              new Message(
                MessageType.SendAggregate,
                this.localTime,
                0, // Don't specify time to let the manager add the latency
                this.id,
                this.node.parents[this.node.members.indexOf(this.id)],
                {
                  aggregate
                }
              )
            )
          }
        }
        break
      case MessageType.RequestHealthChecks:
        console.log(
          `Node #${this.id} (time=${
            this.localTime
          }) is requesting health checks from his children`
        )

        // Check children's health
        for (const child of this.node.children) {
          const msg = new Message(
            MessageType.CheckHealth,
            this.localTime,
            0, // Don't specify time to let the manager add the latency
            this.id,
            child.members[position],
            {
              checkId: receivedMessage.id
            }
          )
          messages.push(msg)
          this.ongoingHealthChecks.push(msg.receiverId)
        }

        // Set a timeout to trigger the recovery procedure for not responding nodes
        messages.push(
          new Message(
            MessageType.HealthCheckTimeout,
            this.localTime,
            this.localTime + 2 * MAX_LATENCY,
            this.id,
            this.id,
            {}
          )
        )

        // Reschedule health checks
        if (!this.finishedWorking) {
          console.log(`Node #${this.id} is rescheduling a health check`)
          messages.push(
            new Message(
              MessageType.RequestHealthChecks,
              this.localTime,
              this.localTime + HEALTH_CHECK_PERIOD,
              this.id,
              this.id,
              {}
            )
          )
        }
        break
      case MessageType.CheckHealth:
        console.log(
          `Node #${this.id} (time=${
            this.localTime
          }) received a health check request.`
        )

        messages.push(
          new Message(
            MessageType.ConfirmHealth,
            this.localTime,
            0, // Don't specify time to let the manager add the latency
            this.id,
            this.node.parents[position],
            {
              checkId: receivedMessage.id
            }
          )
        )
        break
      case MessageType.ConfirmHealth:
        console.log(
          `Node #${this.id} (time=${
            this.localTime
          }) received a health confirmation from node #${
            receivedMessage.emitterId
          } ([${this.ongoingHealthChecks}]).`
        )

        this.ongoingHealthChecks = this.ongoingHealthChecks.filter(
          e => e !== receivedMessage.emitterId
        )
        break
      case MessageType.HealthCheckTimeout:
        console.log(
          `Node #${this.id} (time=${this.localTime}) timed out health checks. ${
            this.ongoingHealthChecks.length
          } ongoing health checks are unanswered.`
        )

        for (const unansweredHealthCheck of this.ongoingHealthChecks) {
          console.log(
            `Node #${unansweredHealthCheck} did not answer the health check, triggering recovery procedure...`
          )
        }
        break
      default:
        throw new Error('Receiving unknown message type')
    }

    return messages
  }
}

export default Node
