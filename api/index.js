const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const app = express();
const port = process.env.PORT || 3001;

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");
const cors = require("cors");

app.use(express.json());

app.use(cors());

// Middleware
app.use(express.json());

// Basic route
app.get("/", (req, res) => {
  res.send("API is running");
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

const db = mysql.createPool({
  host: process.env.MYSQLHOST || "autorack.proxy.rlwy.net",
  user: process.env.MYSQLUSER || "root",
  password: process.env.MYSQLPASSWORD || "yVCxeSJXsYMHsWRKoVUeujqvTzbFRMnq",
  database: process.env.MYSQL_DATABASE || "railway",
  port: process.env.MYSQLPORT || 48730,
  jwtSecret :process.env.JWT_SECRET || "defaultSecretKey"

});
db.getConnection()
  .then((conn) => {
    console.log("Database connected successfully");
    conn.release();
  })
  .catch((error) => {
    console.error("Error connecting to the database:", error);
  });

app.post("/users", (req, res) => {
  const { name, email } = req.body;
  const sql = "INSERT INTO users (name, email) VALUES (?,?) ";
  db.query(sql, [name, email], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err });
    }
    res.json({ id: result.insertId, name, email });
  });
});

app.get("/users", (req, res) => {
  const sql = "SELECT * FROM users";
  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const [existingUsers] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: "Email is already in use." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const token = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });
    const [result] = await db.query(
      "INSERT INTO users (name, email, password, token) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, token]
    );
    res.status(201).json({ id: result.insertId, name, email, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const [results] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (results.length === 0) {
      console.log("User not found");
      return res.status(401).json({ error: "User not found" });
    }

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log("Invalid password");
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );
    await db.query("UPDATE users SET token = ? WHERE id = ?", [token, user.id]);
    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.log("Catch error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/rentals", async (req, res) => {
  const { location, price_min, price_max, bedrooms, bathrooms, status, sort_by } = req.query;

  let query = `
    SELECT 
      rentals.id, 
      rentals.title, 
      rentals.location, 
      rentals.price, 
      rentals.description, 
      rentals.size, 
      rentals.imageUrl, 
      rentals.available_from, 
      rentals.amenities, 
      rentals.status, 
      rentals.bedrooms, 
      rentals.bathrooms, 
      rentals.contact_name, 
      rentals.contact_phone, 
      rentals.contact_email, 
      users.name AS user_name, 
      users.profile_url 
    FROM rentals 
    JOIN users ON users.id = rentals.user_id 
    WHERE 1=1`; // Start with a base query

  const queryParams = [];

  // Add filters based on query parameters
  if (location) {
    query += " AND rentals.location = ?";
    queryParams.push(location);
  }
  if (price_min) {
    query += " AND rentals.price >= ?";
    queryParams.push(price_min);
  }
  if (price_max) {
    query += " AND rentals.price <= ?";
    queryParams.push(price_max);
  }
  if (bedrooms) {
    query += " AND rentals.bedrooms = ?";
    queryParams.push(bedrooms);
  }
  if (bathrooms) {
    query += " AND rentals.bathrooms = ?";
    queryParams.push(bathrooms);
  }
  if (status) {
    query += " AND rentals.status = ?";
    queryParams.push(status);
  }
  if (sort_by) {
    query += ` ORDER BY ${mysql.escapeId(sort_by)} ASC`; 
  }

  try {
    const [results] = await db.query(query, queryParams);
    res.status(200).json(results);
  } catch (error) {
    console.error("Error fetching rentals:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/rentals", async (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  const [rows] = await db.query("SELECT id, email FROM users WHERE token = ?", [
    token,
  ]);

  if (rows.length === 0) {
    throw new Error("User not found");
  }

  const { id: user_id, email: contact_email } = rows[0];
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
  } = req.body;

  try {
    const amenitiesJSON = JSON.stringify(amenities);

    const sql = `
            INSERT INTO rentals 
            (title, location, price, bedrooms, bathrooms, description, size, imageUrl, contact_name, contact_phone, contact_email, available_from, amenities, status,user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
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
      status,
      user_id,
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
      contact_email,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
});
app.get("/api/user", async (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }
  const query =
    "SELECT id, name, email,created_at,location,occupation,phone_number,bio, profile_url FROM users WHERE token = ?";

  try {
    const results = await db.query(query, [token]);
    if (results.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(results[0]);
  } catch (error) {
    console.error("Error fetching user information:", error);
    return res.status(500).json({ error: "Failed to fetch user information" });
  }
});

app.put("/api/user", async (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  const { name, location, occupation, phone_number, bio, profile_url } =
    req.body;

  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }

  try {
    const updateQuery = `
      UPDATE users 
      SET 
        name = ?, 
        location = ?, 
        occupation = ?, 
        phone_number = ?, 
        bio = ?, 
        profile_url = ?
      WHERE 
        token = ?`;
    const [result] = await db.query(updateQuery, [
      name,
      location,
      occupation,
      phone_number,
      bio,
      profile_url,
      token,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Error updating user information:", error);
    return res.status(500).json({ error: "Failed to update user information" });
  }
});

app.post("/api/rental-details", async (req, res) => {
  const { rental_id } = req.body;

  if (!rental_id) {
    return res.status(400).json({ message: "rental_id is required" });
  }

  try {
    const [rows] = await db.query(
      `
      SELECT *
      FROM rentals
      JOIN users
      ON users.id = rentals.user_id
      WHERE rentals.id = ?;
    `,
      [rental_id]
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No data found for the given rental_id" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching user and rental details:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/api/rentals/:rentalId/comments", async (req, res) => {
  const { rentalId } = req.params;
  const { comment } = req.body;
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }

  try {
    const [userRows] = await db.query("SELECT id FROM users WHERE token = ?", [token]);
    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = userRows[0].id;
    const createdAt = new Date(); 
    const sql = "INSERT INTO comments (rental_id, user_id, comment, created_at) VALUES (?, ?, ?, ?)";
    await db.query(sql, [rentalId, userId, comment, createdAt]);

    res.status(201).json({ message: "Comment posted successfully" });
  } catch (error) {
    console.error("Error posting comment:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/rentals/:rentalId/comments", async (req, res) => {
  const { rentalId } = req.params;

  try {
    const sql = `
      SELECT 
        comments.comment, 
        comments.created_at, 
        users.name, 
        users.profile_url, 
        users.bio, 
        users.occupation 
      FROM comments 
      JOIN users ON comments.user_id = users.id 
      WHERE rental_id = ?`;
      
    const [comments] = await db.query(sql, [rentalId]);

    res.status(200).json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get user's own listings
app.get("/api/user/rentals", async (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  
  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }

  try {
    const [userRows] = await db.query("SELECT id FROM users WHERE token = ?", [token]);
    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = userRows[0].id;
    
    const sql = `
      SELECT 
        id, 
        title, 
        location, 
        price, 
        description, 
        size, 
        imageUrl, 
        available_from, 
        amenities, 
        status, 
        bedrooms, 
        bathrooms, 
        contact_name, 
        contact_phone, 
        contact_email,
        created_at
      FROM rentals 
      WHERE user_id = ?
      ORDER BY created_at DESC`;
      
    const [rentals] = await db.query(sql, [userId]);

    res.status(200).json(rentals);
  } catch (error) {
    console.error("Error fetching user rentals:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/rentals/:rentalId", async (req, res) => {
  const { rentalId } = req.params;
  const token = req.headers["authorization"]?.split(" ")[1];
  
  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }

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
  } = req.body;

  try {
    const [userRows] = await db.query("SELECT id FROM users WHERE token = ?", [token]);
    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = userRows[0].id;
    
    const [rentalRows] = await db.query("SELECT id FROM rentals WHERE id = ? AND user_id = ?", [rentalId, userId]);
    if (rentalRows.length === 0) {
      return res.status(404).json({ message: "Rental not found or you don't have permission to edit it" });
    }

    const amenitiesJSON = JSON.stringify(amenities);

    const updateQuery = `
      UPDATE rentals 
      SET 
        title = ?, 
        location = ?, 
        price = ?, 
        bedrooms = ?, 
        bathrooms = ?, 
        description = ?, 
        size = ?, 
        imageUrl = ?, 
        contact_name = ?, 
        contact_phone = ?, 
        available_from = ?, 
        amenities = ?, 
        status = ?
      WHERE id = ? AND user_id = ?
    `;

    await db.query(updateQuery, [
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
      availableFrom || null,
      amenitiesJSON,
      status,
      rentalId,
      userId,
    ]);

    res.status(200).json({ message: "Rental updated successfully" });
  } catch (error) {
    console.error("Error updating rental:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete a rental 
app.delete("/api/rentals/:rentalId", async (req, res) => {
  const { rentalId } = req.params;
  const token = req.headers["authorization"]?.split(" ")[1];
  
  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }

  try {
    const [userRows] = await db.query("SELECT id FROM users WHERE token = ?", [token]);
    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = userRows[0].id;
    const [rentalRows] = await db.query("SELECT id FROM rentals WHERE id = ? AND user_id = ?", [rentalId, userId]);
    if (rentalRows.length === 0) {
      return res.status(404).json({ message: "Rental not found or you don't have permission to delete it" });
    }

    await db.query("DELETE FROM comments WHERE rental_id = ?", [rentalId]);
    
    await db.query("DELETE FROM rentals WHERE id = ? AND user_id = ?", [rentalId, userId]);

    res.status(200).json({ message: "Rental deleted successfully" });
  } catch (error) {
    console.error("Error deleting rental:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Messaging Endpoints ---

app.post("/api/messages/:rentalId", async (req, res) => {
  const { rentalId } = req.params;
  const { content } = req.body;
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }
  if (!content) {
    return res.status(400).json({ message: "Message content is required" });
  }

  try {
    const [userRows] = await db.query("SELECT id FROM users WHERE token = ?", [token]);
    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const senderId = userRows[0].id;

    const [rentalRows] = await db.query("SELECT user_id FROM rentals WHERE id = ?", [rentalId]);
    if (rentalRows.length === 0) {
      return res.status(404).json({ message: "Rental not found" });
    }
    const receiverId = rentalRows[0].user_id;

    const [result] = await db.query(
      "INSERT INTO messages (rental_id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)",
      [rentalId, senderId, receiverId, content]
    );
    const [messageRows] = await db.query("SELECT * FROM messages WHERE id = ?", [result.insertId]);
    res.status(201).json({ success: true, message: messageRows[0] });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/messages/:rentalId", async (req, res) => {
  const { rentalId } = req.params;
  const { participantId } = req.query;
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }
  if (!participantId) {
    return res.status(400).json({ message: "participantId is required" });
  }

  try {
    const [userRows] = await db.query("SELECT id FROM users WHERE token = ?", [token]);
    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const userId = userRows[0].id;

    // Only fetch messages between the current user and the participant for this rental
    const [messages] = await db.query(
      `SELECT * FROM messages WHERE rental_id = ? AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) ORDER BY timestamp ASC`,
      [rentalId, userId, participantId, participantId, userId]
    );
    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/conversations", async (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(400).json({ message: "Token is required" });
  try {
    const [userRows] = await db.query("SELECT id FROM users WHERE token = ?", [token]);
    if (userRows.length === 0) return res.status(404).json({ message: "User not found" });
    const userId = userRows[0].id;
    const [conversations] = await db.query(
      `SELECT c.*, r.title AS rental_title, r.location AS rental_location, r.imageUrl AS rental_imageUrl, 
              u1.name AS user_name, u2.name AS owner_name,
              m.content AS last_message, m.timestamp AS last_message_time
       FROM conversations c
       JOIN rentals r ON c.rental_id = r.id
       JOIN users u1 ON c.user_id = u1.id
       JOIN users u2 ON c.owner_id = u2.id
       LEFT JOIN messages m ON m.id = (
           SELECT id FROM messages 
           WHERE conversation_id = c.id 
           ORDER BY timestamp DESC LIMIT 1
       )
       WHERE c.user_id = ? OR c.owner_id = ?
       ORDER BY c.last_updated DESC`,
      [userId, userId]
    );
    res.status(200).json({ conversations });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// 1. Create or get a conversation for a rental between the current user and the owner
app.post("/api/conversations", async (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  const { rentalId } = req.body;
  if (!token) return res.status(400).json({ message: "Token is required" });
  if (!rentalId) return res.status(400).json({ message: "rentalId is required" });
  try {
    const [userRows] = await db.query("SELECT id FROM users WHERE token = ?", [token]);
    if (userRows.length === 0) return res.status(404).json({ message: "User not found" });
    const userId = userRows[0].id;
    const [rentalRows] = await db.query("SELECT id, user_id FROM rentals WHERE id = ?", [rentalId]);
    if (rentalRows.length === 0) return res.status(404).json({ message: "Rental not found" });
    const ownerId = rentalRows[0].user_id;
    if (userId === ownerId) return res.status(400).json({ message: "Owner cannot start a conversation with themselves" });
    const [convRows] = await db.query(
      "SELECT * FROM conversations WHERE rental_id = ? AND user_id = ? AND owner_id = ?",
      [rentalId, userId, ownerId]
    );
    let conversation;
    if (convRows.length > 0) {
      conversation = convRows[0];
    } else {
      const [result] = await db.query(
        "INSERT INTO conversations (rental_id, user_id, owner_id) VALUES (?, ?, ?)",
        [rentalId, userId, ownerId]
      );
      const [newConvRows] = await db.query("SELECT * FROM conversations WHERE id = ?", [result.insertId]);
      conversation = newConvRows[0];
    }
    res.status(200).json({ conversation });
  } catch (error) {
    console.error("Error creating/getting conversation:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// 2. Get all conversations for the current user (as user or owner)
app.get("/api/conversations", async (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(400).json({ message: "Token is required" });
  try {
    const [userRows] = await db.query("SELECT id FROM users WHERE token = ?", [token]);
    if (userRows.length === 0) return res.status(404).json({ message: "User not found" });
    const userId = userRows[0].id;
    const [conversations] = await db.query(
      `SELECT c.*, r.title AS rental_title, r.location AS rental_location, r.imageUrl AS rental_imageUrl, 
              u1.name AS user_name, u2.name AS owner_name
       FROM conversations c
       JOIN rentals r ON c.rental_id = r.id
       JOIN users u1 ON c.user_id = u1.id
       JOIN users u2 ON c.owner_id = u2.id
       WHERE c.user_id = ? OR c.owner_id = ?
       ORDER BY c.last_updated DESC`,
      [userId, userId]
    );
    res.status(200).json({ conversations });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// 3. Get all messages for a conversation (if user is a participant)
app.get("/api/conversations/:conversationId/messages", async (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  const { conversationId } = req.params;
  if (!token) return res.status(400).json({ message: "Token is required" });
  try {
    const [userRows] = await db.query("SELECT id FROM users WHERE token = ?", [token]);
    if (userRows.length === 0) return res.status(404).json({ message: "User not found" });
    const userId = userRows[0].id;
    const [convRows] = await db.query("SELECT * FROM conversations WHERE id = ?", [conversationId]);
    if (convRows.length === 0) return res.status(404).json({ message: "Conversation not found" });
    const conv = convRows[0];
    if (conv.user_id !== userId && conv.owner_id !== userId) {
      return res.status(403).json({ message: "Not authorized to view this conversation" });
    }
    const [messages] = await db.query(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC",
      [conversationId]
    );
    res.status(200).json({ messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// 4. Send a message in a conversation (if user is a participant)
app.post("/api/conversations/:conversationId/messages", async (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  const { conversationId } = req.params;
  const { content } = req.body;
  if (!token) return res.status(400).json({ message: "Token is required" });
  if (!content) return res.status(400).json({ message: "Message content is required" });
  try {
    const [userRows] = await db.query("SELECT id FROM users WHERE token = ?", [token]);
    if (userRows.length === 0) return res.status(404).json({ message: "User not found" });
    const userId = userRows[0].id;
    const [convRows] = await db.query("SELECT * FROM conversations WHERE id = ?", [conversationId]);
    if (convRows.length === 0) return res.status(404).json({ message: "Conversation not found" });
    const conv = convRows[0];
    if (conv.user_id !== userId && conv.owner_id !== userId) {
      return res.status(403).json({ message: "Not authorized to send message in this conversation" });
    }
    const rentalId = conv.rental_id;
    await db.query(
      "INSERT INTO messages (conversation_id, rental_id, sender_id, content) VALUES (?, ?, ?, ?)",
      [conversationId, rentalId, userId, content]
    );
    await db.query(
      "UPDATE conversations SET last_updated = CURRENT_TIMESTAMP WHERE id = ?",
      [conversationId]
    );
    res.status(201).json({ message: "Message sent" });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Server error" });
  }
});
