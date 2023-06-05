export async function sendObservation({
  client,
  supervisorWebhook,
  observationPayload,
  retries = 1
}) {
  if (supervisorWebhook) {
    for (let tries = 0; tries < retries; tries++) {
      try {
        console.log(observationPayload)
        await client.stackClient.fetchJSON(
          'POST',
          supervisorWebhook,
          JSON.stringify(observationPayload)
        )
        break
      } catch (err) {
        console.log('Failed to send an observation:', err)
        if (tries < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }
  }
}
