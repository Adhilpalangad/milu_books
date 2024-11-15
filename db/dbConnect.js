const mongoose = require("mongoose")

//db connection

const connectDb = async () => {
  try {
    await mongoose.connect("mongodb+srv://vambuadhil:vambuadhil@cluster0.r6ekc.mongodb.net/test")
    console.log("MongoDb Connected")
  } catch {
      console.log("fail to connect db")
      
  }
}

module.exports = connectDb
