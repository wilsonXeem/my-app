const bcrypt = require('bcryptjs')

// Models
const User = require('../models/user')

// Helper functions
const { getUser } = require('../util/user')
const error = require('../util/error-handling/error-handler')
const { removeImage } = require('../util/images/image')

/******************************
 *  Get Current User Timeline *
 ******************************/
module.exports.getUserTimeline = async (req, res, next) => {
    const userId = req.params.userId

    try {
        const user = await User.findById(userId, { password: 0 })
            .populate("friends posts")
            .populate({
                path: "posts",
                populate: [
                    {
                        path: "creator",
                        select: "firstName lastName fullName profileImage"
                    },
                    {
                        path: "like",
                        select: "firstname lastName fullName profileImage"
                    }
                ]
            })
        // Check if user is undefined
        if (!user) error.errorHandler(404, "User not found")

        // Continue if there are no errors

        // Send current user object back to client
        res.status(200).json({ ...user._doc, name: user.fullName })
    } catch (err) {
        error.error(err, next)
    }
}

/************************
 *  Get Profile Details *
 ************************/
module.exports.getProfileDetails = async (req, res, next) => {
    req.userId = "5dc44cfcc6bf2c3e3f1cab72"

    try {
        // Get and validate user
        const user = await User.findById(req.user).populate("friends requests")

        if (!user) error.errorHandler(404, "No user found")

        // Send response back to client
        res
            .status(200)
            .json({ message: "User details successfully fetched", user })
    } catch (err) {
        error.error(err)
    }
}

/***************************
 *  Update Profile Details *
 ***************************/
module.exports.postUpdateProfileDetails = async (req, res, next) => {
    const userId = req.userId

    const firstName = req.body.firstName,
        lastName = req.body.lastName,
        password = req.body.password,
        occupation = req.body.work,
        email = req.body.email

    try {
        // Check if user is authenticated
        if (!req.isAuth) error.errorHandler(403, "Not Authorized")

        // Get and validate user
        const user = await getUser(userId)

        // Continue if there are no errors

        user.firstName = firstName

        user.lastName = lastName

        user.details.occupation = occupation

        user.details.email = email

        if (password) {
            // Encrypt new password
            const hashedPw = await bcrypt.hash(password, 12)

            user.password = hashedPw
        }

        // Save user updates back to database
        await user.save()

        // Return response back to the client
        res
            .status(200)
            .json({ message: "Profile updated", updated: user.details, status: 200 })
    } catch (err) {
        error.error(err, next)
    }
}

/********************************
 *  Change Profile Image/Banner *
 ********************************/
module.exports.changeImage = async (req, res, next) => {
    const type = req.body.type,
        userId = req.userId

    const filename = req.file.filename,
        fileId = req.file.Id

    try {
        // Check if user is authenticated
        if (!req.isAuth) error.errorHandler(403, "Not Authorized")

        const user = await User.findById(userId, { password: 0 })
            .populate("friends posts")
            .populate({
                path: "posts",
                populate: {
                    path: "creator",
                    select: "firstName lastName fullName profileImage"
                }
            })

        // Check if user is undefined
        if (!user) error.errorHandler(403, "No use found")

        // Get old imageUrl and imageId
        let imageUrl, imageId

        if (type === "profile") {
            imageUrl = user.profileImage.imageUrl
            imageId = user.profileImage.imageId
        } else if (type === "banner") {
            imageUrl = user.banner.imageUrl
            imageId = user.banner.imageId
        }

        switch (type) {
            case "profile":
                user.profileImage.imageUrl = `${process.env.API_URI}/${filename}`
                user.profileImage.imageId = fileId
                await removeImage(imageUrl, imageId)
                break;

            case "banner":
                user.profileImage.imageUrl = `${process.env.API_URI}/${filename}`
                user.profileImage.imageId = fileId
                await removeImage(imageUrl, imageId)
                break;

            default:
                return;
        }

        // Save user changes back to database
        await user.save()
        res.status(200).json({ message: "Image updated", user })
    } catch (err) {
        error.error(err, next)
    }
}