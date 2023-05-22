export async function sendObservation({
  client,
  supervisorWebhook,
  observationPayload,
  retries = 1
}) {
  if (supervisorWebhook) {
    for (let tries = 0; tries < retries; tries++) {
      try {
        await client.stackClient.fetchJSON(
          'POST',
          supervisorWebhook,
          observationPayload
        )
        break
      } catch (err) {
        if (tries < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }
  }
}
