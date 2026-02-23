import express from 'express'; // Imports Express.js.

const app = express() // Creates an Express application instance.
const port = 3000

app.get('/', (req, res) => {
  res.send('Hello World!')
}) // Defines a route (/) that returns Hello, World!.

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
}) // Starts the server on port 3000 and logs a confirmation message.