const express = require('express')
const router = express.Router()

// Controllers
const profileControllers = require('../controllers/profile')

router.get("/timeline/:userId", profileControllers.getUserTimeline)

router.post("/details", profileControllers.getProfileDetails)
router.patch("/details/update", profileControllers.postUpdateProfileDetails)

router.patch("/image", profileControllers.changeImage);

module.exports = router