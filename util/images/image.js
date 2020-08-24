const mongoose = require('mongoose')
const Grid = require('gridfs-stream')
const ObjectId = mongoose.Types.ObjectId

// Set up monggose connection
const conn = mongoose.createConnection("mongodb://localhost/FB_Clone", { useNewUrlParser: true, useUnifiedTopology: true })

// Set up grids stream
let gfs

conn.once("open", () => {
    gfs = Grid(conn.db, mongoose.mongo)
    gfs.collection("uploads")
})

module.exports = {
    removeImage: async (filename, fileId, type = "id") => {
        // Check to make sure that filename isn't equal to the default filename
        if (
            filename === `no_profile.jpg`
        )
            return

        if (
            filename === `profile.png`
        )
            return

        // Remove file from uploads.files
        if (type === "id") {
            gfs.remove(
                { _id: ObjectId(`${fileId}`), root: "uploads" },
                (err, gridStore) => {
                    if (err) return console.log(err)
                    return
                }
            )
        } else {
            const name = filename.split(`${process.env.API_URI}/`)[1]

            gfs.remove({filename: name, root: "uploads"}, (err, gridStore) => {
                if (err) return console.log(err)
                return
            })
        }
    }
}