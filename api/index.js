const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const cors = require('cors');


app.use(cors());

// Middleware
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
    res.send('API is running');
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});


// Create MySQL connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
}).promise();

// Connect to MySQL
db.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

app.post('/users', (req, res) => {
    const { name, email } = req.body;
    const sql = 'INSERT INTO users (name, email) VALUES (?,?) ';
    db.query(sql, [name, email], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err });
        }
        res.json({ id: result.insertId, name, email });
    });
});

app.get('/users', (req, res) => {
    const sql = 'SELECT * FROM users';
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    
    try {
        const checkEmailQuery = 'SELECT * FROM users WHERE email = ?';
        db.query(checkEmailQuery, [email], async (err, results) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (results.length > 0) {
                return res.status(400).json({ error: 'Email is already in use.' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const sql = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
            db.query(sql, [name, email, hashedPassword], (err, result) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                const token = jwt.sign({ id: result.insertId, email }, process.env.JWT_SECRET, { expiresIn: '30d' });
                res.status(201).json({ id: result.insertId, name, email, token });
            });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



app.post('/login', (req, res) => {
    const { email, password } = req.body;

    const sql = 'SELECT * FROM users WHERE email = ?';
    db.query(sql, [email], async (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        const user = results[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.status(200).json({ message: 'Login successful', token });
    });
});

app.get('/rentals',async(req,res)=>{
    const query = 'SELECT * FROM rentals';
    try {
        const [result] = await db.query(query);
        const formattedResult = result.map((rental) => ({
            id: rental.id,
            title: rental.title,
            location: rental.location,
            price: `₹${parseFloat(rental.price).toLocaleString()}/month`,
            bedrooms: rental.bedrooms,
            bathrooms: rental.bathrooms,
            size: rental.size,
            imageUrl: rental.imageUrl,
            description: rental.description,
            availableFrom: new Date(rental.available_from).toISOString().split('T')[0],
            amenities: rental.amenities,  
            status: rental.status,
            contact: {
                name: rental.contact_name,
                phone: `+91 ${rental.contact_phone}`,
                email: rental.contact_email
            }
        }));

        res.json(formattedResult);
    } catch (error) {
        console.error("Error fetching rentals:", error);
        res.status(500).send("Server Error");
    }

})

