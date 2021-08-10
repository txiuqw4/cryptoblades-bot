const express = require('express')
const app = express()
const port = 3000

const {data, work, information} = require('./work') 
const timestamp = new Date()

app.get('/', (req, res) => {
  res.json({
      status: 200,
      timestamp: timestamp,
      accounts: data,
      ...information
  })
})

app.listen(port, () => {
  console.log(`Application listening at http://localhost:${port}`)
})

work()
