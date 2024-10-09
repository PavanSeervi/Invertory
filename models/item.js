const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    // Add other fields as needed
});

const Item = mongoose.model('Item', itemSchema);

module.exports = Item;
