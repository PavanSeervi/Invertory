const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const Invoice = require('./models/invoice');
const Item = require('./models/item');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 5000;

// User Model
const User = require('./models/User');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.use(new LocalStrategy(async (username, password, done) => {
    try {
        const user = await User.findOne({ username });
        if (!user) {
            return done(null, false, { message: 'User not found' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return done(null, false, { message: 'Incorrect password' });
        }
        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    const user = await User.findById(id);
    done(null, user);
});

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/billing', {})
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Routes for User authentication
app.get('/login', (req, res) => {
    res.render('login', { error: null }); // Pass error as null initially
});


app.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err); // Pass the error to the next middleware
        }
        if (!user) {
            return res.render('login', { error: info.message }); // Pass the error message to the view
        }
        req.logIn(user, (err) => {
            if (err) {
                return next(err);
            }
            return res.redirect('/'); // Redirect to the home page after successful login
        });
    })(req, res, next);
});


app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    const { username, password, role } = req.body;

    // Optionally, hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ username, password: hashedPassword, role }); // Ensure this line is correct
    await newUser.save();
    res.redirect('/login');
});


app.post('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) {
            return next(err); // Handle the error if needed
        }
        res.redirect('/login'); // Redirect to the login page after logout
    });
});


// Protect routes
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// Routes

// Route to render the home page
app.get('/', ensureAuthenticated, async (req, res) => {
    const items = await Item.find(); // Fetch all items
    res.render('index', { items, user: req.user }); // Pass items and user to the index view
});



// Route to display the item list
app.get('/items', ensureAuthenticated, async (req, res) => {
    const items = await Item.find();
    res.render('itemList', { items });
});

// Route to add a new item
app.post('/api/items', async (req, res) => {
    const newItem = new Item(req.body);
    try {
        await newItem.save();
        res.redirect('/');
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


// Edit and delete routes
app.get('/api/items/:id/edit', async (req, res) => {
    const item = await Item.findById(req.params.id);
    if (!item) {
        return res.status(404).send('Item not found');
    }
    res.render('edit', { item });
});

app.post('/api/items/:id', async (req, res) => {
    try {
        await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.redirect('/items'); // Redirect to item list after editing
    } catch (error) {
        res.status(400).send('Error updating item');
    }
});

app.post('/api/items/:id/delete', async (req, res) => {
    try {
        await Item.findByIdAndDelete(req.params.id);
        res.redirect('/items'); // Redirect to item list after deleting
    } catch (error) {
        res.status(400).send('Error deleting item');
    }
});

app.post('/api/invoices', async (req, res) => {
    const { customerName, items } = req.body;

    // Check if items is defined and is an array
    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Items must be an array' });
    }

    let totalAmount = 0;

    try {
        // Process the items to calculate the total amount
        const invoiceItems = await Promise.all(items.map(async (item) => {
            const foundItem = await Item.findById(item.itemId);
            if (!foundItem) {
                throw new Error(`Item with ID ${item.itemId} not found`);
            }

            const price = foundItem.price;
            const quantity = item.quantity;
            totalAmount += price * quantity;

            return { item: foundItem._id, quantity, price }; // Prepare the item for the invoice
        }));

        // Create a new invoice
        const invoice = new Invoice({
            customerName,
            items: invoiceItems,
            totalAmount,
        });

        await invoice.save(); // Save the invoice to the database
        res.redirect(`/invoices/${invoice._id}`); // Redirect to the newly created invoice
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


// Route to display a specific invoice
app.get('/invoices/:id', async (req, res) => {
    const invoice = await Invoice.findById(req.params.id).populate('items.item'); // Populate item details
    if (!invoice) {
        return res.status(404).send('Invoice not found');
    }
    res.render('invoice', { invoice }); // Render the invoice view
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});