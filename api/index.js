const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const app = express();
const port = process.env.PORT || 3001;

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const cors = require('cors');

app.use(express.json());



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



const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
}).promise();

    db.getConnection()
    .then(conn => {
        console.log('Database connected successfully');
        conn.release(); // Release the connection back to the pool
        // Do something with the connection if needed
    })
    .catch(error => {
        console.error('Error connecting to the database:', error);
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
        const [existingUsers] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Email is already in use.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const token = jwt.sign({  email }, process.env.JWT_SECRET, { expiresIn: '30d' });
        const [result] = await db.query('INSERT INTO users (name, email, password, token) VALUES (?, ?, ?, ?)', [name, email, hashedPassword, token]);
        res.status(201).json({ id: result.insertId, name, email, token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});




app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    console.log('email:', email);

    try {
        const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (results.length === 0) {
            console.log('User not found');
            return res.status(401).json({ error: 'User not found' });
        }

        const user = results[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            console.log('Invalid password');
            return res.status(401).json({ error: 'Invalid password' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });
        console.log('Token generated:', token);
        res.status(200).json({ message: 'Login successful', token });
    } catch (error) {
        console.log('Catch error:', error);
        res.status(500).json({ error: 'Server error' });
    }
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

app.post('/rentals', async (req, res) => {
    console.log(req.body);
    const { 
        title, 
        location, 
        price, 
        bedrooms, 
        bathrooms, 
        size, 
        imageUrl, 
        description, 
        availableFrom, 
        amenities,  
        status, 
        contact_name, 
        contact_phone, 
        contact_email 
    } = req.body;

    try {
       
        const amenitiesJSON = JSON.stringify(amenities);

        const sql = `
            INSERT INTO rentals 
            (title, location, price, bedrooms, bathrooms, description, size, imageUrl, contact_name, contact_phone, contact_email, available_from, amenities, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await db.query(sql, [
            title, 
            location, 
            price, 
            bedrooms, 
            bathrooms, 
            description, 
            size, 
            imageUrl || null,
            contact_name, 
            contact_phone, 
            contact_email, 
            availableFrom || null,
            amenitiesJSON,  
            status
        ]);

        res.status(201).json({
            id: result.insertId, 
            title, 
            location, 
            price, 
            bedrooms, 
            bathrooms, 
            size, 
            imageUrl, 
            description, 
            availableFrom, 
            amenities, 
            status, 
            contact_name, 
            contact_phone, 
            contact_email
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
});
