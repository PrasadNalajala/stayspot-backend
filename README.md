```markdown
# 🌟 StaySpot Backend - The Power Behind Your Rental Experience 🏡✨

Welcome to the **StaySpot** backend! This Express.js application serves as the backbone for the StaySpot frontend, providing essential APIs to manage user authentication and property listings. 🚀

## 🛠 Technologies Used

The StaySpot backend is built with the following technologies:

- **Express**: A fast and minimalist web framework for Node.js. 🚄
- **MySQL**: A relational database management system for storing user and rental data. 🗄️
- **Bcrypt**: For hashing passwords securely. 🔐
- **jsonwebtoken**: For implementing authentication and authorization. 🛡️
- **Nodemon**: For automatically restarting the server during development. 🔄
```
## 🚀 Getting Started

To set up the StaySpot backend, follow these steps:

1. **Clone the Repository** 📥
   ```bash
   git clone https://github.com/yourusername/stayspot-backend.git
   
2. **Navigate to the Project Directory** 📂
   ```bash
   cd stayspot-backend
   ```

3. **Install Dependencies** 🔧
   ```bash
   npm install
   ```

4. **Create a `.env` File** 📝
   Create a `.env` file in the root directory and add the following environment variables:
   ```plaintext
   DB_HOST=localhost
   DB_USER=root
   DB_NAME=stayspot_backend
   PORT=3006
   JWT_SECRET=your__secret_key
   ```

5. **Run the Application** 🎉
   ```bash
   npm start
   ```
   Alternatively, for development, you can use:
   ```bash
   npm run dev
   ```
   The server will be running at `http://localhost:3000`. 🌐

## 📡 API Endpoints

- **POST /api/register**: Register a new user. 🆕
- **POST /api/login**: Authenticate a user and return a JWT token. 🔑
- **GET /api/rentals**: Retrieve a list of rental properties. 📃
- **POST /api/rentals**: Create a new rental property. 🏘️
- **PUT /api/rentals/:id**: Update an existing rental property. ✏️
- **DELETE /api/rentals/:id**: Delete a rental property. 🗑️

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 📜

## 🙌 Contributing

We welcome contributions! 🤝 Feel free to submit a pull request or open an issue if you have suggestions or improvements. 💡

## 🤝 Support

If you have any questions or need assistance, please reach out via [your email] 📧 or open an issue in the repository.

Thank you for visiting the **StaySpot** backend! Happy coding! 🛠️✨
```

