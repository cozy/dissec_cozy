import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useClient, useQuery } from 'cozy-client'
import Button from 'cozy-ui/transpiled/react/Buttons'
import FormControlLabel from 'cozy-ui/transpiled/react/FormControlLabel'
import Switch from 'cozy-ui/transpiled/react/Switch'
import { latestModelUpdateQuery, observationWebhookQuery } from 'lib/queries'
import { JOBS_DOCTYPE } from 'doctypes'
import Typography from 'cozy-ui/transpiled/react/Typography'

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
    <div className="u-card u-flex u-flex-column u-mv-half">
      <Typography variant="h4">
        Latest model trained at {lastModel?.cozyMetadata?.updatedAt || '???'}
      </Typography>
      <FormControlLabel
        label="Use model from distributed training?"
        control={
          <Switch
            color="primary"
            checked={pretrained}
            onChange={handlePretrained}
          />
        }
      />
      <Button
        variant="primary"
        label="Launch classification"
        onClick={handleClassify}
        busy={!!currentJob}
      />
    </div>
  )
}

export default ClassifyOperations
