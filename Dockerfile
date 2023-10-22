# Use an official Node.js runtime as a parent image
FROM node:18

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install project dependencies using npm
RUN npm install

# Expose port 3000 for the application
EXPOSE 8080

# Copy the rest of the application code to the working directory
COPY . .

# Define the command to start the application
CMD ["npm", "start"]
