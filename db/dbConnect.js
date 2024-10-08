const mongoose = require("mongoose")

//db connection

const connectDb = async () => {
  try {
    await mongoose.connect("mongodb://localhost:27017/")
    console.log("MongoDb Connected")
  } catch {
      console.log("fail to connect db")
      
  }
}

module.exports = connectDb
