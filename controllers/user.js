const { validationResult } = require('express-validator')
const { forEach } = require('p-iteration')
const io = require('../util/socket')
const multer = require('multer')

// Models
const Post = require('../models/post'),
    User = require('../models/user'),
    Chat = require('../models/chat')

// Helper functions
const error = require('../util/error-handling/error-handler')
const { userExist, getUser } = require('../util/user')
const { getPost, populatePost } = require('../util/post')
const { getChat, validChatUser } = require('../util/chat')
const { notifyFriend, notifyFriendRequest } = require('../util/notifications')
const { removeImage } = require('../util/images/image')
const isAuth = require('../util/is-auth/isAuth')

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/")
    },
    filename: (req, file, cb) => {
        console.log(file)
        cb(null, file.originalname)
    }
})

/***************
 * Create Post *
 ***************/
module.exports.postCreatePost = async (req, res, next) => {
    const upload = multer({ storage }).single("image")
    upload(req, res, (err) => {
        if (err) {
            return res.send(err)
        }

        const cloudinary = require("cloudinary").v2
        cloudinary.config({
            cloud_name: "muyi-hira-app",
            api_key: "324347284575678",
            api_secret: "jE7V2LLM0-2zz0cNPHLlCkXuU4E"
        })

        const path = req.file.path
        const uniqueFilename = req.file.filename

        cloudinary.uploader.upload(
            path,
            { public_id: `muyi-hira/${uniqueFilename}`, tags: "muyi-hira" },
            async (err, image) => {
                if (err) return res.send(err)
                console.log("file uploaded to cloudinary");

                var fs = require("fs")
                fs.unlinkSync(path)

                const content = req.body.content,
                    postImage = image.url,
                    privacy = req.body.privacy

                try {
                    // Check if user is authenticated
                    if (!req.isAuth) error.errorHandler(res, "Not Authorized", "user")

                    const userId = req.body.userId

                    // Get current user
                    const user = await userExist("id", userId)

                    // Check if user is undefined
                    if (!user) error.errorHandler(res, "Not Authorized", "user")

                    // Check if both inputs are invalid
                    if (!content && !image) error.errorHandler(res, "No content posted", "input")

                    // Continue if there are no errors

                    // Check if there is an image selected
                    let imageUrl
                    if (image) {
                        imageUrl = postImage
                    }

                    // Create new post
                    const post = new Post({
                        content,
                        postImage: imageUrl,
                        privacy,
                        creator: user._id.toString()
                    })

                    // Add new post to post array in user
                    user.posts.push(post)
                    await user.save()

                    // Save post to database
                    const createdPost = await post.save()

                    io.getIO().emit("posts", { action: "create post" })

                    // Return response back to client
                    res
                        .status(201)
                        .json({ message: "Post successfully created!", createdPost })
                } catch (err) {
                    error.error(err, next)
                }

            }
        )
    })
}

/***************
 * Update Post *
 ***************/
module.exports.postUpdatePost = async (req, res, next) => {
    const upload = multer({ storage }).single("image")
    upload(req, res, (err) => {
        if (err) {
            return res.send(err)
        }

        const cloudinary = require("cloudinary").v2
        cloudinary.config({
            cloud_name: "muyi-hira-app",
            api_key: "324347284575678",
            api_secret: "jE7V2LLM0-2zz0cNPHLlCkXuU4E"
        })

        const path = req.file.path
        const uniqueFilename = req.file.filename

        cloudinary.uploader.upload(
            path,
            { public_id: `muyi-hira/${uniqueFilename}`, tags: "muyi-hira" },
            async (err, image) => {
                if (err) return res.send(err)
                console.log("file uploaded to cloudinary");

                var fs = require("fs")
                fs.unlinkSync(path)

                const userId = req.userId

                const postId = req.body.postId,
                    content = req.body.content,
                    postImage = image.url

                try {
                    const post = await getPost(postId)

                    // Check if both content and postImage is undefined
                    if (!content && !postImage) error.errorHandler(res, "Post cannot be empty", "input")

                    // Check if post creator id matches current user id
                    if (post.creator.toString() !== userId.toString()) {
                        error.errorHandler(res, "Not Authorized", "user")
                    }

                    // Continue if there are no errors

                    post.content = content

                    if (postImage) {
                        post.postImage = postImage
                    }

                    // Set edit date on post
                    post.edited = Date.now()

                    // Save updated post to database
                    await post.save()

                    // Send response back to client
                    res.status(201).json({ message: "Post has been successfully updated", post })
                } catch (err) {
                    error.error(err, next)
                }
            }
        )
    })
}

/***************
 * Delete Post *
 ***************/
module.exports.postDeletePost = async (req, res, next) => {
    const userId = req.userId
    const postId = req.body.postId

    try {
        // Check if user is authnticated
        if (!req.isAuth) error.errorHandler(res, "Not Authorized", "user")

        const post = await getPost(postId)

        // Check if post exist
        if (!post) error.errorHandler(res, "Post not found", "post")

        //Check if user has permission to remove post
        if (post.creator.toString() !== userId)
            error.errorHandler(res, "Not Authorized", "user")

        // Continue if there are no errors

        // Get current user
        const user = await userExist("id", userId)

        // Check if user is undefined
        if (!user) error.errorHandler(res, "User not found", "user")

        // Check if post has an image
        const postImage = post.postImage

        if (postImage) {
            removeImage(postImage, null, "imageUrl")
        }

        // Loop through post comments for all post with images and remove them from the database
        if (post.comments.length > 0) {
            post.comments.forEach(comment => {
                if (comment.postImage) removeImage(comment.postImage, null, "imageUrl")

                if (comment.replies.length > 0) {
                    comment.replies.forEach(reply => {
                        if (reply.postImage) removeImage(reply.postImage, null, "imageUrl")
                    })
                }
            })
        }

        // Remove post from posts array
        user.posts.pull(postId)
        await user.save()

        // Remove post from posts array
        await Post.findByIdAndDelete(postId)

        // Check if post has image
        if (post.postImage) {
            const imageUrl = post.postImage
            removeImage(imageUrl, null, "filename")
        }

        io.getIO().emit("posts", {
            action: "delete post",
            postId: post._id.toString()
        })

        // Send response back to client
        res.status(201).json({ message: "Post successfully deleted", post })
    } catch (err) {
        error.error(err, next)
    }
}

/**********************
 *     Get Posts      *
 **********************/
module.exports.getPosts = async (req, res, next) => {
    const userId = req.userId
    try {
        const user = await User.findById(userId).populate("posts")

        // Check if user is defined
        if (!user) error.errorHandler(res, "User not found", "user")

        // Continue if there are no errors

        const posts = user.posts

        // Send response back to client
        res.status(200).json({ message: "Posts successfully fetched", posts })
    } catch (err) {
        error.error(err, next)
    }
}

/******************
 *  Send Request  *
 ******************/
module.exports.sendRequest = async (req, res, next) => {
    const friendId = req.body.friendId
    const userId = req.body.userId

    try {

        // Get receiving user info
        const receivingUser = await getUser(friendId),
            currentUser = await userExist("id", userId)

        // Check if currentUser exist
        if (!currentUser) error.errorHandler(res, "Not Authorized", "user")

        // Check if currentUser doen't already have a pending request from other user
        if (
            currentUser.requests.content.find(req => req.user.toString() === friendId)
        ) {
            error.errorHandler(
                res,
                "You already have a pending request from this user", "friend"
            )
        }

        // Check if requestingUser doesn't already have pending same request
        const existingRequest = receivingUser.requests.content.find(
            item => item.user.toString() === userId
        )

        if (existingRequest)
            error.errorHandler(res, "You already have a pending request", "user")

        // Check if users aren't already friends
        const isFriends = currentUser.friends.find(
            friend => friend.toString() === friendId
        )

        if (isFriends) {
            error.errorHandler(res, "Already friends with this user", "user")
        }

        // Continue if no errors

        // Add to request count for receiving user
        receivingUser.requests.count = receivingUser.requests.count + 1

        // Add notification to users about the request
        await notifyFriendRequest(currentUser, receivingUser, "friend request")

        const contentData = {
            user: userId,
            date: Date.now()
        }

        // Add requestingUser to receivingUser requests array
        receivingUser.requests.content.push(contentData)
        await receivingUser.save()

        io.getIO().emit("notification")
        io.getIO().emit("friend")

        // Send response back to client
        res.status(200).json({
            message: "Friend request sent!",
            status: 200,
            friends: {
                firstName: receivingUser.firstName,
                lastName: receivingUser.lastName,
                fullName: receivingUser.fullName,
                _id: receivingUser._id,
                requests: receivingUser.requests,
                profileImage: receivingUser.profileImage
            }
        })
    } catch (err) {
        error.error(err, next)
    }
}

/**************************
 * Decline Friend Request *
 **************************/
module.exports.declineRequest = async (req, res, next) => {
    // Get requesting UserId
    const requestId = req.body.requestId

    const userId = req.body.userId

    try {
        // Check if friendId is undefined
        if (!requestId) error.errorHandler(res, "No request found", "request")

        // Continue if there are no errors
        const user = await userExist("id", userId)

        // Check if user is undefined
        if (!user) error.errorHandler(res, "Not Authorized", "user")

        // Check if requesting user exists
        const existingRequest = user.requests.content.find(
            req => req._id.toString() === requestId
        )

        if (!existingRequest) error.errorHandler(res, "Friend request not found", "request")

        // Remove count from user
        if (user.requests.count !== 0) {
            user.requests.count = user.requests.count - 1
        }

        user.requests.content.pull(requestId)

        await user.save()

        io.getIO().emit("notification")

        res.status(200).json({ message: "Friend request declined", status: 200 })
    } catch (err) {
        error.error(err, next)
    }
}

/*************************
 * Accept Friend Request *
 *************************/
module.exports.acceptRequest = async (req, res, next) => {
    const friendId = req.body.friendId
    const requestId = req.body.requestId

    const userId = req.body.userId

    try {
        // Get current user profile
        const currentUser = await userExist("id", userId)

        // Check if currentUser is undefined
        if (!currentUser) error.errorHandler(res, "Not Authorized", "user")

        // Get rquestingUser profile
        const requestingUser = await getUser(friendId)

        // Add both users to friends array
        currentUser.friends.push(requestingUser)
        requestingUser.friends.push(currentUser)

        // Remove notification from currentUser
        currentUser.requests.count = currentUser.requests.count - 1

        // Add notification to both users, notifying about them being friends
        await notifyFriend(currentUser, requestingUser, "friend request")

        // Remove friend request from currentUser requests array
        currentUser.requests.content.pull(requestId)

        // Save changes to database
        await currentUser.save()
        await requestingUser.save()

        io.getIO().emit("notification")
        io.getIO().emit("handle friend", {
            action: "accept request",
            id: [userId, friendId]
        })

        // Send reponse back to client 
        res.status(200).json({ message: "Friend request accepted", status: 200 })
    } catch (err) {
        error.error(err, next)
    }
}

/*************************
 * Cancel Friend Request *
 *************************/
module.exports.cancelFriendRequest = async (req, res, next) => {
    const friendId = req.body.friendId
    const userId = req.body.userId
    try {
        const friend = await User.findById(
            friendId,
            "requests firstName lastName fullName profileImage"
        )

        // Check to see if friend is undefined
        if (!friend) error.errorHandler(res, "User not found", "friend")

        // Remove pending request on friend requests content
        friend.requests.content = friend.requests.content.filter(
            req => req.user.toString() !== userId.toString()
        )

        // Decrement friend request count
        if (friend.requests.count > 0) {
            friend.requests.count = friend.requests.count - 1
        }

        await friend.save()

        io.getIO().emit("notification")

        // Send response back to client
        res
            .status(200)
            .json({ message: "Friend request concelled", status: 200, friend })
    } catch (err) {
        error.error(err, next)
    }
}

/******************
 *  Remove Friend *
 ******************/
module.exports.removeFriend = async (req, res, next) => {
    const userId = req.userId
    const friendId = req.body.friendId

    try {
        // Check if ser is authenticated
        if (!req.isAuth) error.errorHandler(403, "Not Authorized")

        const friend = await getUser(friendId)

        // Get currentUser
        const currentUser = await userExist("id", userId)

        // Check if currentUser is undefined
        if (!currentUser) error.errorHandler(403, "Not Authorized")

        // Check if friendId does not exist in currentUser's friends list
        if (!currentUser.friends.includes(friendId)) {
            error.errorHandler(404, "Friend not found")
        }

        // Continue if there are no errors

        // Remove friend from currentUser
        currentUser.friends.pull(friendId)

        // Remove currentUser from friend
        friend.friends.pull(userId)

        // Save changes to database
        await currentUser.save()
        await friend.save()

        io.getIO().emit("notification")
        io.getIO().emit("handle friend", {
            action: "accept request",
            id: [userId, friendId]
        })

        // Send response back to client
        res
            .status(200)
            .json({ message: "Friend successfully removed", status: 200 })
    } catch (err) {
        error.error(err, next)
    }
}

/****************
 * Send Message *
 ****************/
module.exports.postSendMessage = async (req, res, next) => {
    const friendId = req.body.friendId,
        message = req.body.message,
        userId = req.userId

    try {
        // Check if user is authenticated
        if (!req.isAuth) error.errorHandler(403, "Not Authorized")

        // Get and validate user
        const user = await getUser(userId)

        // Get and validate friend
        const friend = await getUser(friendId)

        // Check input validation
        const validatorErrors = validationResult(req)

        error.validationError(validatorErrors)

        // Continue if there are no errors

        // Check if you already have a chat going on with just the user
        const existingChat = await Chat.findOne({
            $and: [
                { users: { $elemMatch: { userId: friendId } } },
                { users: { elemMatch: { userId: userId } } }
            ]
        })

        if (existingChat) {
            // Add onto existingChat with friend

            // Push new message unto messages array on chat
            existingChat.messages.push({
                user: userId,
                message,
                date: Date.now()
            })
            // Add count to messages for recipient user
            friend.messages.count = friend.messages.count + 1

            await friend.save()

            // Save changes back to database
            await existingChat.save()
        } else {
            // Create new chat with friend

            // Create new chat object
            const chat = new Chat({
                user: [
                    {
                        userId: friendId
                    },
                    {
                        userId: userId
                    }
                ],
                messages: [
                    {
                        user: userId,
                        message
                    }
                ]
            })

            // Add created messages to both current user and friend messages array
            user.messages.content.unshift(chat)
            friend.messages.content.unshift(chat)

            // Save update back to database
            await chat.save()
            await user.save()
            await friend.save()
        }

        // Send response back to client
        res.status(200).json({ message: "Message sent!", status: 200 })
    } catch (err) {
        error.error(err, next)
    }
}

/***************************
 *  Add Friend to Message  *
 ***************************/
module.exports.postAddFriendToMessage = async (req, res, next) => {
    const userId = req.userId,
        chatId = req.body.chatId,
        friendId = req.body.friendId

    try {
        // Check if user is authenticated
        if (!req.isAuth) error.errorHandler(403, "Not Authorized")

        // Get message and verify it still exists
        const chat = await getChat(chatId)

        // Verify current chat to see if current requesting user is allowed to add in new users
        validChatUser(chat, userId)

        const user = await getUser(userId)

        if (!user.friends.includes(friendId))
            error.errorHandler(404, "Friend not found")

        // Check if friend isn't already in the chat
        if (
            chat.users.find(user => user.userId.toString() === friendId.toString())
        ) {
            error.errorHandler(422, "This user is already in the chat")
        }

        // Continue if there are no errors

        // Add friend to chat users array
        chat.users.push({ userId: friendId })

        const friend = await getUser(friendId, "messages")

        // Add current chatId to friend messages array
        friend.messages.content.unshift(chatId)

        // Add to message count
        friend.messages.count = friend.messages.count + 1

        // Save updates back to database
        await chat.save()
        await friend.save()

        io.getIO().emit("message", {
            action: "add user",
            chatId
        })

        // Send response back to client
        res
            .status(200)
            .json({ message: "Friend has been added to the chat", status: 200 })
    } catch (err) {
        error.error(err, next)
    }
}

/******************************
 * Remove Friend From Message *
 ******************************/
module.exports.postRemoveFriendFromMessage = async (req, res, next) => {
    req.userId = "5dc44cfcc6bf2c3e3f1cab72"

    const chatId = req.body.chatId,
        friendId = req.body.friendId,
        userItemId = req.body._id

    try {
        // Get and validate chat
        const chat = await getChat(chatId)

        // Verify current chat to see if current requesting user is allowed to remove user
        validChatUser(chat, req.userId)

        const user = await getUser(req.userId)

        // Check if friend still exists in user's friend list
        if (!user.friends.includes(friendId))
            error.errorHandler(404, "Friend not found")

        // Check if friend is still in current chat
        if (!chat.users.find(user => user.userId.toString() === friendId.toString())) {
            error.errorHandler(404, "User not currently in chat")
        }

        // Continue if there are no errors

        // Pull friend from chat users array
        await chat.users.pull(userItemId)

        const friend = await getUser(friendId, "messages")

        // Remove chatId from friend messages array
        friend.messages.content.pull(chatId)

        // Save updates back to database
        await chat.save()
        await friend.save()

        // Send response back to client
        res.status(200).json({ message: "User removed from chat" })
    } catch (err) {
        error.error(err, next)
    }
}

/**************
 * Leave Chat *
 **************/
module.exports.postLeaveChat = async (req, res, next) => {
    const chatId = req.body.chatId,
        userItemId = req.body.userItemId,
        userId = req.userId

    try {
        // Check if user is authenticated
        if (!req.isAuth) error.errorHandler(403, "Not Authorized")

        // Get and validate user
        const user = await getUser(userId, "messages")

        // Get and validate current chat message
        const chat = await getChat(chatId)

        // Check if user is currently in the chat
        validChatUser(chat, userId)

        // Continue if there are no errors

        // Remove current user from chat users array
        chat.users.pull(userItemId)

        // Remove chatId from current user messages array
        user.messages.content.pull(chatId)

        // Save changes back to database
        await chat.save()
        await user.save()

        // Check if there no users in the users array in the chat object
        const totalUsers = chat.users.length

        if (totalUsers <= 0) {
            // Delete entire message object from database
            await chat.remove({})
        }

        io.getIO().emit("messages", { action: "leave  chat", chatId })

        // Send response back to client
        res.status(200).json({ message: "You have left the chat" })
    } catch (err) {
        error.error(err, next)
    }
}

/****************
 * Get Messages *
 ****************/
module.exports.getMessages = async (req, res, next) => {
    const userId = req.params.userId

    try {
        // Check if user is authenticated
        if (!req.isAuth) error.errorHandler(403, "You must be logged in to access messages")

        // Get and validate user
        const user = await User.findById(userId, "messages").populate({
            path: "messages.content",
            populate: [
                {
                    path: "users.userId",
                    select: "firstName lastName fullName profileImage"
                },
                {
                    path: "messages.user",
                    select: "firstName lastName fullName profileImage"
                }
            ]
        })

        if (!user) error.errorHandler(403, "No user found")

        // Send response back to client
        res.status(200).json({
            message: "Messages fetched successfully",
            messages: user.messages,
            status: 200
        })
    } catch (err) {
        error.error(err, next)
    }
}

/*******************
 *    Messaging    *
 *******************/
module.exports.postMessaging = async (req, res, next) => {
    req.userId = "5dc44cfcc6bf2c3e3f1cab72"

    const chatId = req.params.id,
        message = req.body.message

    try {
        // Get and validate chat
        const chat = await getChat(chatId)

        // Check if valid user
        validChatUser(chat, req.userId)

        // Check input validation
        const validationError = validationResult(req)

        error.validationError(validationError)

        // Continue if there are no errors

        // Create message object
        const newMessage = {
            user: req.userId,
            message
        }

        // Send message notifications to all users in current chat except the current user

        const chatUsers = chat.users

        forEach(chatUsers, async item => {
            const user = await User.findById(item.userId)

            if (user && item.userId.toString() !== req.userId.toString()) {
                // Send message notification to each valid user

                // Check if user doesn't already have current chatId in their messages content array
                const existingChatNotification = user.messages.content.includes(chatId)

                if (existingChatNotification) {
                    // Pull existing chat from user
                    await user.messages.content.pull(chatId)

                    // Unshift new chat content onto user
                    user.messages.content.unshift(chatId)
                } else {
                    // Unshift chat id onto messages content array
                    user.messages.content.unshift(chatId)
                }

                // Add to messages count on user
                user.messages.count = user.messages.count + 1

                // Save user changes back to database
                await user.save()
            }
        })

        // Push new message onto messages array in chat object
        chat.messages.puch(newMessage)

        // Save chat updates back to database
        await chat.save()

        // Send response back to client
        res.status(200).json({ message: "Message sent" })
    } catch (err) {
        error.error(err, next)
    }
}

/******************
 * Create Message *
 ******************/
module.exports.postCreateMessage = async (req, res, next) => {
    const userId = req.userId

    const recipients = req.body.recipients,
        message = req.body.message

    try {
        // Check for validation errors
        const validationError = validationResult(req)
        error.validationError(validationError)

        // Get length of recipients
        const numOfRecipients = recipients.length

        // Check if there isn't already an existing chat with selected users
        const chat = await Chat.findOne({
            users: { $size: numOfRecipients },
            "users.userId": { $all: recipients }
        })

        // Initialize chatId
        let chatId

        if (!chat) {
            // Create new chat instance
            const newChat = new Chat({
                users: recipients.map(user => {
                    return {
                        userId: user
                    }
                }),
                messages: [
                    {
                        user: userId,
                        message
                    }
                ]
            })

            chatId = newChat._id.toString()

            // Save changes back to database
            await newChat.save()
        } else {
            // Send message to existing chat instance
            chat.messages.push({
                user: userId,
                message
            })

            chatId = chat._id.toString()

            // Save chat updates back to database
            await chat.save()
        }

        // Add new chatId to currentUser and all recipients

        // Loop through recipients array and add new chatId to messages array
        recipients.forEach(async id => {
            const user = await getUser(id)

            // Add to messages count for all recipients except the sender
            if (user._id.toString() === chatId.toString()) {
                user.messages.count = user.messages.count + 1
            }

            // Check for existing messages content
            const existingMessageContent = user.messages.content.find(
                item => item.toString() === chatId.toString()
            )

            if (existingMessageContent) {
                await user.messages.content.pull(existingMessageContent)

                user.messages.content.unshift(chatId)
            } else {
                user.messages.content.unshift(chatId)
            }

            await user.save()
        })

        io.getIO().emit("notification")
        io.getIO().emit("messages", {
            action: "send message",
            chatId
        })

        // Send response back to client
        res.status(200).json({ message: "Message sent", status: 200 })
    } catch (err) {
        error.error(err, next)
    }
}

/********************
 * Get User Profile *
 ********************/
module.exports.getUserProfile = async (req, res, next) => {
    const userId = req.params.userId

    try {
        // Get and validate user
        const user = await User.findById(userId, {
            password: 0
        })
            .populate(
                "requests.content.user",
                "firstName lastName fullName profileImage"
            )
            .populate(populatePost)
            .populate({
                path: "friends",
                select: "firstName lastName fullName profileImage",
                options: { limit: 12 }
            })

        // Check if user is defined
        if (!user) error.errorHandler(404, "User not found")

        // Send response back to client
        res.status(200).json({ message: "User successfully fetched", user })
    } catch (err) {
        error.error(err, next)
    }
}

/********************
 * Get User Friends *
 ********************/
module.exports.getUserFriends = async (req, res, next) => {
    const userId = req.params.userId

    try {
        // Get and validate user 
        const user = await User.findById(
            userId,
            "friends firstName lastName"
        ).populate("friends", "firstName lastName profileImage")

        if (!user) error.errorHandler(res, "User not found", "user")

        // Continue if there are no errors

        // Send response back to client
        res.status(200).json({ message: "Friends successfully fetched", user })
    } catch (err) {
        error.error(err, next)
    }
}

/***********************
 * Clear Message Count *
 ***********************/
module.exports.clearMessageCount = async (req, res, next) => {
    const userId = req.userId

    try {
        // Check if user is authenticated
        if (!req.isAuth) error.errorHandler(403, "Not Authorized")

        const user = await User.findById(userId, "messages")

        // Check if user is undefined
        if (!user) error.errorHandler(404, "User not found")

        // Reset user message count
        user.messages.count = 0

        await user.save()

        io.getIO().emit("notification")

        // Send response back to client
        res.status(200).json({ message: "Message count cleared", status: 200 })
    } catch (err) {
        error.error(err, next)
    }
}

/******************************
 * Clear Friend Request count *
 ******************************/
module.exports.clearFriendRequestCount = async (req, res, next) => {
    const userId = req.userId

    try {
        // Get user
        const user = await User.findById(userId, "requests")

        // Check if user is undefined
        if (!user) error.errorHandler(res, "User not found", "user")

        // Continue if there are no errors

        // Set requests count to 0
        user.requests.count = 0

        // Save changes back to database
        await user.save()

        io.getIO().emit("notification")

        // Send response back to client
        res.status(200).json({ message: "Friend request count reset", status: 200 })
    } catch (err) {
        error.error(err, next)
    }
}

/*******************
 * Search For User *
 *******************/
module.exports.searchUser = async (req, res, next) => {
    const name = req.body.name

    try {
        // Check if user is authenticated
        if (!req.isAuth) error.errorHandler(403, "Not Authorized")

        const user = await User.find(
            {
                $or: [
                    { firstName: { $regex: name, $options: "i" } },
                    { lastName: { $regex: name, $options: "i" } }
                ]
            },
            "firstName lastName fullName profileImage"
        )

        res.status(200).json(user)
    } catch (err) {
        error.error(err, next)
    }
}

/*********************
 * Search For Friend *
 *********************/
module.exports.searchFriend = async (req, res, next) => {
    const userId = req.params.userId

    const name = req.body.name

    try {
        // Check if user is authenticated
        if (!req.isAuth) error.errorHandler(403, "Not Authorized")

        // Get user
        const user = await User.findById(userId).friends.find(
            {
                $or: [
                    { firstName: { $regex: name, $options: "i" } },
                    { lastName: { $regex: name, $options: "i" } }
                ]
            },
            "firstName lastName fullName profileImage"
        )

        if (!user) error.errorHandler(404, "User not found")

        res.status(200).json()
    } catch (err) {
        error.error(err, next)
    }
}

/*******************
 * Get Single Chat *
 *******************/
module.exports.getChat = async (req, res, next) => {
    const chatId = req.params.chatId
    const userId = req.userId

    try {
        // Check if user is auithenticated
        if (!req.isAuth) error.errorHandler(403, "Not Authorized")

        const chat = await Chat.findById(chatId)
            .populate("users.userId", "firstName lastName fullName profileImage")
            .populate("messages.user", "firstName lastName fullName profileImage")

        // Check if chat exists
        if (!chat) error.errorHandler(404, "No chat found")

        // Check if current userId is included in users array of chat
        const isIncluded = chat.users.filter(
            user => user.userId._id.toString() === userId.toString()
        )

        if (isIncluded.length === 0) error.errorHandler(403, "Not Authorized")

        // Continue if there are no errors

        res.status(200).json({ message: "Chat fetch", chat, status: 20 })
    } catch (err) {
        error.error(err, next)
    }
}

/***************************
 * Get User Friend Request *
 ***************************/
module.exports.getFriendRequests = async (req, res, next) => {
    const userId = req.userId

    try {
        // Check if user is authenticated
        if (!req.isAuth) error.errorHandler(403, "Not Authorized")

        const user = await User.findById(userId)
            .populate(
                "requests.content.user",
                "firstName lastName fullName profileImage"
            )
            .populate(
                "requests.content.friendId",
                "firstName lastName fullName profileImage"
            )

        // Check if user is undefined
        if (!user) error.errorHandler(404, "User not found")

        res.status(200).json({ status: 200, request: user.requests })
    } catch (err) {
        error.error(err, next)
    }
}