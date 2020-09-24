const express = require('express')
const router = express.Router()
const { body } = require('express-validator')

// Controllers
const authControllers = require('../controllers/auth')

router.post(
    "/signup",
    [
        body("firstName", "First name cannot be empty")
            .not()
            .isEmpty(),
        body("lastName", "Last name cannot be empty")
            .not()
            .isEmpty(),
        body("email", "Email is invalid")
            .isEmail()
            .not()
            .isEmpty(),
        body("password", "Password must be at least 8 characters long")
            .isLength({ min: 8 })
            .not()
            .isEmpty(),
        body("dob")
            .not()
            .isEmpty()
            .withMessage("Please enter a valid date of birth")
            .custom((value, { req }) => {
                const dob = new Date(value)

                const dateDiff = new Date(Date.now() - dob.getTime())

                const age = Math.abs(dateDiff.getUTCFullYear() - 1970)

                if (age < 18) {
                    return Promise.reject(
                        "You must be at least 18 years or older to sign up"
                    )
                }

                return true
            }),
        body("gender", "Please select a gender")
            .not()
            .isEmpty(),
    ],
    authControllers.postSignup
)

router.post("/login", authControllers.postLogin)

router.post(
    "/password-reset",
    [
        body("email", "Please enter a valid email")
            .isEmail()
            .not()
            .isEmpty()
    ],
    authControllers.postPasswordReset
)

router.get("/password-reset/:resetToken", authControllers.getPasswordChange)
router.patch("/password-reset/new", authControllers.postPasswordChange)

module.exports = router