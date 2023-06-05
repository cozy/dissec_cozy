import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useClient, useQuery } from 'cozy-client'
import Button from 'cozy-ui/react/Button'
import { latestModelUpdateQuery, observationWebhookQuery } from 'lib/queries'
import { JOBS_DOCTYPE } from 'doctypes'
import { FormControlLabel, Switch } from '@material-ui/core'

export const ClassifyOperations = () => {
  const client = useClient()
  const observeWebhookQuery = observationWebhookQuery()
  const { data: supervisorWebhooks } = useQuery(
    observeWebhookQuery.definition,
    observeWebhookQuery.options
  )
  const modelQuery = latestModelUpdateQuery()
  const { data: lastModelData } = useQuery(
    modelQuery.definition,
    modelQuery.options
  )
  const [lastModel] = lastModelData || []
  const [currentJob, setCurrentJob] = useState()
  const [pretrained, setPretrained] = useState(true)
  const supervisorWebhook = useMemo(() => {
    if (!client || !supervisorWebhooks || !supervisorWebhooks[0]) return
    return `${client.options.uri}/jobs/webhooks/${supervisorWebhooks[0].id}`
  }, [client, supervisorWebhooks])

  console.log(supervisorWebhook)
  const handleClassify = useCallback(async () => {
    const res = await client.collection(JOBS_DOCTYPE).create('service', {
      slug: 'dissecozy',
      name: 'categorize',
      pretrained: pretrained,
      supervisorWebhook
    })
    setCurrentJob(res.data.id)
  }, [client, pretrained, supervisorWebhook])

  const handlePretrained = useCallback(() => {
    setPretrained(!pretrained)
  }, [pretrained])

  useEffect(() => {
    if (currentJob) {
      const interval = setInterval(async () => {
        const res = await client.stackClient.fetchJSON(
          'GET',
          `${client.options.uri}/jobs/${currentJob}`
        )

        if (res?.data?.attributes?.state === 'done') {
          setCurrentJob()
          clearInterval(interval)
        }
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [client.options.uri, client.sta, client.stackClient, currentJob])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <span>
        Latest model trained at {lastModel?.cozyMetadata?.updatedAt || '???'}
      </span>
      <FormControlLabel
        label="Use model from distributed training?"
        control={
          <Switch
            checked={pretrained}
            onChange={handlePretrained}
            name="Use model from distributed training?"
          />
        }
      />
      <Button
        onClick={handleClassify}
        busy={!!currentJob}
        label="Launch classification"
        size="large"
        extension="full"
      />
    </div>
  )
}

export default ClassifyOperations
