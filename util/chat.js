// Models
const Chat = require('../models/chat')

// Helper functions
const error = require('./error-handling/error-handler')

module.exports = {
    getChat: async chatId => {
        const chat = await Chat.findById(chatId)

        // Check if chat is undefined
        if (!chat) error.errorHandler(404, "No message exists")

        return chat
    },
    validChatUser: (chat, userId) => {
        const validUser = chat.user.find(
            user => user.userId.toString() === userId.toString()
        )

        if (!validUser) error.errorHandler(403, "Not authorized")
    }
}