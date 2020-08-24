const express = require('express')
const dotenv = require('dotenv')
const multer = require('multer')
const mongoose = require('mongoose')
const Grid = require('gridfs-stream')
const GridFSStorage = require('multer-gridfs-storage')
const bodyParser = require('body-parser')
const compression = require('compression')
const error = require("./util/error-handling/error-handler")
const isAuth = require('./util/is-auth/isAuth')
const User = require('./models/user')

// Set up dotenv
dotenv.config()

// Set up mongoose connection
const conn = mongoose.createConnection("mongodb://localhost/FB_Clone", { useNewUrlParser: true, useUnifiedTopology: true })

// Set up gridfs stream
let gfs

conn.once('open', () => {
    gfs = Grid(conn.db, mongoose.mongo)
    gfs.collection('uploads')
})

// Set up storage for multer to store in mongodb
const storage = new GridFSStorage({
    url: 'mongodb://localhost/FB_Clone',
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            const imageUrl = `${file.originalname}`

            const fileInfo = {
                imageUrl: imageUrl,
                bucketName: "uploads"
            }
            resolve(fileInfo)
        })
    }
})

// Set up filefilter for multer
const fileFilter = (req, file, cb) => {
    // check for valid file types
    if (
        file.mimetype === "image/jpg" ||
        file.mimetype === "image/jpeg" ||
        file.mimetype === "image/png"
    ) {
        cb(null, true)
    } else {
        cb(null, false)
    }
}

// Routes
const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/user')
const feedRoutes = require('./routes/feed')
const profileRoutes = require('./routes/profile')

const app = express()

app.use(compression())

// Parse incoming requests
app.use(bodyParser.json())
const upload = (multer({ storage: storage, fileFilter }).single("image"))
// const upload = multer({dest: 'mongodb://localhost/FB_Clone'}).single("image")

app.patch("/image", (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            res.status(400).send("Something went wrong!")
        }
        res.send(req.file)
    })
})

// Set headers
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, , X-Requested-With, Origin, Accept"
    )
    res.setHeader(
        "Access-Control-Allow-Methods",
        "OPTIONS, GET, POST, PUT, PATCH, DELETE"
    )

    if (req.method === "OPTIONS") {
        return res.sendStatus(200)
    }

    next()
})

// Authentication check
app.use(isAuth)

// Get images from database
app.get("/image", async (req, res, next) => {
    const imageUrl = req.body.imageUrl
    try {
        // Read output to browser
        const readstream = gfs.createReadStream(imageUrl, {
            highWaterMark: Math.pow(20, 40)
        })

        readstream.pipe(res)
    } catch (err) {
        error.error(err, next)
    }
})

// Endpoints
app.use("/feed", feedRoutes)
app.use("/auth", authRoutes)
app.use("/user", userRoutes)
app.use("/profile", profileRoutes)

// Error handler
app.use((err, req, res, next) => {
    const status = err.statusCode,
        message = err.message,
        type = err.type || ""

    res.status(status).json({ message, status, type })
})

mongoose
    .connect('mongodb://localhost/FB_Clone', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(result => {
        const server = app.listen(process.env.PORT || 8000, () => console.log("server started"))

        const io = require('./util/socket').init(server)

        io.on("connection", socket => { })
    })
    .catch(err => console.log(err))