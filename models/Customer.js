// models/Customer.js
const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    name: String,
    contact: String,
    address: String,
});

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
