const mongoose = require('mongoose')
const Schema = mongoose.Schema

const postSchema = new Schema(
    {
    content: String,
    postImage: String,
    edited: Date,
    creator: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "User"
    },
    likes: [
        {
            type: Schema.Types.ObjectId,
            ref: "User"
        }
    ],
    privacy: {
        type: String,
        required: true,
        default: "friends"
    },
    comments: [
        {
            user: {
                type: Schema.Types.ObjectId,
                required: true,
                ref: "User"
            },
            content: String,
            postImage: String,
            createdAt: {
                type: Date,
                default: Date.now
            },
            likes: [
                {
                    type: Schema.Types.ObjectId,
                    ref: "User"
                }
            ],
            replies: [
                {
                    user: {
                        type: Schema.Types.ObjectId,
                        required: true,
                        ref: "User"
                    },
                    edited: String,
                    content: String,
                    postImage: String,
                    createdAt: {
                        type: Date,
                        default: Date.now
                    },
                    likes: [
                        {
                            type: Schema.Types.ObjectId,
                            ref: "User"
                        }
                    ]
                }
            ]
        }
    ]
},
{
    timestamps: true
}
)

module.exports = mongoose.model("Post", postSchema)