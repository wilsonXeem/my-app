const dotenv = require('dotenv')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { validationResult } = require('express-validator')
const crypto = require('crypto')
const nodemailer = require('nodemailer')
const sgTransport = require('nodemailer-sendgrid-transport')

const jwtKey = "alhamdulillahgaAllah"
const jwtExpirySeconds = 300
dotenv.config()

const options = {
    auth: {
        api_user: process.env.SENDGRID_USER,
        api_key: process.env.SENDGRID_KEY
    }
}

const client = nodemailer.createTransport(sgTransport(options))

// Models
const User = require('../models/user')

// Helper functions
const error = require('../util/error-handling/error-handler')

const { userExist } = require('../util/user')

/***************
 * User Signup *
 ***************/
module.exports.postSignup = async (req, res, next) => {
    const email = req.body.email,
        firstName = req.body.firstName,
        lastName = req.body.lastName,
        dob = req.body.dob,
        password = req.body.password,
        gender = req.body.gender

    try {
        // Check for validation errors
        const validatorErrors = validationResult(req)
        error.validationError(validatorErrors, res)

        // Check if a user with that email already exist
        const emailExist = await userExist("email", email)

        if (emailExist) error.errorHandler(res, "Email already exists", "email")

        // Continue if there are no errors

        const hashedPw = await bcrypt.hash(password, 12)

        // Create new user object
        const user = new User({
            firstName,
            lastName,
            details: { email, gender },
            dateOfBirth: dob,
            password: hashedPw
        })

        // Save user in database
        const createUser = await user.save()

        // Send response back to client
        res.status(201).json({ message: "Sign Up successful", type: "user",  createUser })
    } catch (err) {
        error.error(err, next)
    }
}

/**************
 * User Login *
 **************/
module.exports.postLogin = async (req, res, next) => {
    const email = req.body.email,
        password = req.body.password

    try {
        // Check for validation errors
        const validatorErrors = validationResult(req)
        error.validationError(validatorErrors)

        // Check if user exists
        const user = await userExist("email", email)

        if (!user) error.errorHandler(res, "Incorrect email", "email")

        // Compare if password match
        const pwMatch = await bcrypt.compare(password, user.password)

        if (!pwMatch) error.errorHandler(res, "Incorrect password", "password")

        // Continue if there are no errors

        // Create jsonwebtoken
        const token = jwt.sign(
            { userId: user._id.toString(), email: user.email },
            jwtKey, { algorithm: "HS256", expiresIn: jwtExpirySeconds }
        )

        // Send response to client
        res.status(200).json({ token, userId: user._id.toString() })
    } catch (err) {
        error.error(err, next)
    }
}

/**********************
 * Post Password Reset *
 **********************/
module.exports.postPasswordReset = async (req, res, next) => {
    const email = req.body.email.toLowerCase()

    try {
        // Check if user exists with that email
        const user = await User.findOne(
            { "details.email": email },
            "details resetToken resetExpiration"
        )

        // Check for validation errors
        const validatorErrors = validationResult(req)
        error.validationError(validatorErrors, res)

        // Check if user is undefined
        if (!user) error.errorHandler(res, "No user found with that email", "email")

        // Continue if there are no errors

        // Generate random reset token
        const resetToken = await crypto.randomBytes(32).toString("hex")

        // Calculate passwordExpiration
        const resetExpiration = Date.now() + 3600000

        // Update found user object
        user.resetToken = resetToken
        user.resetExpiration = resetExpiration

        // Send password reset email to user
        client.sendMail({
            to: email,
            from: "xeem@muyihira.com",
            subject: "Password reset",
            html: `
            <h3>You have requested a password reset</h3>
            <p>Follow this <a href="password-reset-token">link</a> here to reset your password</p>
            <p>Password reset link is only valid for an hour</p>
            `
        })

        // Save user updates back to database
        await user.save()

        // Send response back to client
        res
            .status(200)
            .json({ message: "A password reset link has been sent to your email", type: "message" })
    } catch (err) {
        error.error(err, next)
    }
}

/***********************
 * Get Password Change *
 ***********************/
module.exports.getPasswordChange = async (req, res, next) => {
    const token = req.params.resetToken

    try {
        // Check for matching token on a user
        const user = await User.findOne(
            { resetToken: token },
            "resetToken resetExpiration"
        )

        // Check if user is undefined
        if (!user) error.errorHandler(res, "Invalid Token", "token")

        // Check if token has expired
        if (user.resetExpiration < Date.now()) {
            // Clear user reset token and expiration
            user.resetToken = undefined
            user.resetExpiration = undefined

            // Save user back to database
            await user.save()
            error.errorHandler(res, "Password reset session has expired", "message")
        }

        res.status(200).json({ token, status: 200 })
    } catch (err) {
        error.error(err, next)
    }
}

/************************
 * Post Password Change *
 ************************/
module.exports.postPasswordChange = async (req, res, next) => {
    const password = req.body.password,
        resetToken = req.body.resetToken

    try {
        // Get user
        const user = await User.findOne({ resetToken }, "password resetToken")

        // Check if user is undefined
        if (!user) error.errorHandler(res, "No user found", "user")

        // Continue if there are no error

        // Hash password
        const hashedPw = await bcrypt.hash(password, 12)

        // Assign new password to user
        user.password = hashedPw

        // Remove resetToken/Expiration
        user.resetToken = undefined
        user.resetExpiration = undefined

        // Save user changes back to database
        await user.save()

        // Send response back to client
        res
            .status(201)
            .json({ message: "Password successfully changed" })
    } catch (err) {
        error.error(err, next)
    }
}