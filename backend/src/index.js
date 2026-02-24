// // import express from 'express'; // Imports Express.js.

// // const app = express() // Creates an Express application instance.
// // const port =  process.env.PORT || 3000;

// // app.get('/', (req, res) => {
// //   res.send('Hello World!')
// // }) // Defines a route (/) that returns Hello, World!.

// // app.listen(port, () => {
// //   console.log(`Example app listening on port ${port}`)
// // }) // Starts the server on port 3000 and logs a confirmation message.
// const express = require('express');
// const cors = require('cors');
// require('dotenv').config();

// const authRoutes = require('./routes/auth');

// const app = express();

// app.use(cors());
// app.use(express.json());

// app.use('/auth', authRoutes);

// app.listen(process.env.PORT, () => {
//   console.log(`Server running on port ${process.env.PORT}`);
// });

// New ES Module
import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import routes from './routes.js';  // note the .js extension

// dotenv.config();

const app = express();
app.use(express.json());
app.use('/api', routes);

app.listen(3000, () => {
  console.log('Server running on port 3000');
});