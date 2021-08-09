const express = require('express')
const app = express()
const port = 3000

const {data, work, lastCheck} = require('./work') 
const timestamp = new Date()

app.get('/', (req, res) => {
  res.json({
      status: 200,
      last_check: lastCheck,
      timestamp: timestamp,
      accounts: data
  })
})

app.listen(port, () => {
  console.log(`Application listening at http://localhost:${port}`)
})

work()
