const fs = require('fs')
const data = require('../data/operations.json')

const main = () => {
  let records = data['io.cozy.bank.operations']

  for (let i = 0; i < 5; i++) {
    records.sort(() => Math.random() * 2 - 1)
  }

  fs.writeFileSync(
    process.argv[2],
    JSON.stringify(
      { 'io.cozy.bank.operations': records.slice(0, process.argv[3]) },
      null,
      2
    )
  )
}

main()