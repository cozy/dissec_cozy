const fs = require('fs')
const data = require('../data/operations.json')

const main = () => {
  const currentInstance = Number(process.argv[3])

  const createRecord = (label, category) => ({
    label,
    cozyCategoryId: category,
    amount: 1000 * (Math.random() - 0.5)
  })

  let records = []
  // Aggregators don't get data
  switch (currentInstance) {
    case 4:
      records.push(createRecord("producteur de lait", "400110"))
      break
    case 5:
      records.push(createRecord("petit bateau", "400200"))
      break
    case 6:
      records.push(createRecord("carte de bus", "400200"))
      break
    case 7:
      records.push(createRecord("ticket de bus", "400200"))
      break
    case 8:
      records.push(createRecord("producteur de fruits", "400110"))
      break
    case 9:
      records.push(createRecord("mangeur de fruits", "400110"))
      break
    case 10:
      records.push(createRecord("bateau de mer", "400200"))
      break
  }

  console.log('Creating records:', records)

  fs.writeFileSync(
    process.argv[2],
    JSON.stringify(
      { 'io.cozy.bank.operations': records },
      null,
      2
    )
  )
}

main()