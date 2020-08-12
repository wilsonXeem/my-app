const mongoose = require('mongoose')
const Schema = mongoose.Schema

const chatSchema = new Schema ({
    users: [
        {
            userId: {
                type: Schema.Types.ObjectId,
                required: true,
                ref: "User"
            }
        }
    ],
    messages: [
        {
            user: {
                type: Schema.Types.ObjectId,
                required: true,
                ref: "User"
            },
            message: {
                type: String,
                required: true
            },
            date: {
                type: Date,
                required: true,
                default: Date.now
            }
        }
    ]
})

module.exports = mongoose.model("Chat", chatSchema)