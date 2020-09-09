const bcrypt = require('bcryptjs')
const multer = require('multer')
const { generateHex } = require('../util/idGenerator')

// Models
const User = require('../models/user')

// Helper functions
const { getUser } = require('../util/user')
const error = require('../util/error-handling/error-handler')

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
    if (!user) error.errorHandler(res, "User not found", "user")

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
  const userId = req.body.userId

  try {
    // Get and validate user
    const user = await User.findById(userId).populate("friends requests")

    if (!user) error.errorHandler(res, "No user found", "user")

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
  const userId = req.body.userId

  const firstName = req.body.firstName,
    lastName = req.body.lastName,
    occupation = req.body.work,
    email = req.body.email,
    about = req.body.about

  try {

    // Get and validate user
    const user = await getUser(userId)

    // Continue if there are no errors

    user.firstName = firstName

    user.lastName = lastName

    user.details.occupation = occupation

    user.details.email = email

    user.details.about = about
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
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/")
  },
  filename: (req, file, cb) => {
    console.log(file)
    cb(null, file.originalname)
  }
})

module.exports.changeImage = async (req, res, next) => {
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
    const uniqueFilename = new Date().toString()

    cloudinary.uploader.upload(
      path,
      { public_id: `muyi-hira/${uniqueFilename}`, tags: "muyi-hira" },
      async (err, image) => {
        if (err) return res.send(err)
        console.log("file uploaded to cloudinary");

        var fs = require("fs")
        fs.unlinkSync(path)

        const type = req.body.type,
          userId = req.body.userId;

        const filename = image.url,
          fileId = generateHex();

        try {
          const user = await User.findById(userId)
            .populate("friends posts")
            .populate({
              path: "posts",
              populate: {
                path: "creator",
                select: "firstName lastName fullName profileImage"
              }
            });
          // Check if user is undefined
          if (!user) error.errorHandler(res, "No user found", "user");

          switch (type) {
            case "profile":
              user.profileImage.imageUrl = `${filename}`;
              user.profileImage.imageId = fileId;
              break;

            case "banner":
              user.bannerImage.imageUrl = `${filename}`;
              user.bannerImage.imageId = fileId;
              break;

            default:
              return;
          }

          // Save user changes back to database
          await user.save();
          res.status(200).json({ message: "Image updated", user });
        } catch (err) {
          error.error(err, next);
        }
      }
    )
  })
};